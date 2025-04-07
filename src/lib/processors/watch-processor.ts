// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import Log from "../telemetry/logger";
import { Binding } from "../types";
import { Capability } from "../core/capability";
import { Event } from "../enums";
import {
  K8s,
  KubernetesObject,
  WatchCfg,
  WatchEvent,
  GenericClass,
} from "kubernetes-fluent-client";
import { Queue } from "../core/queue";
import { WatchPhase, WatcherType } from "kubernetes-fluent-client/dist/fluent/types";
import { KubernetesListObject } from "kubernetes-fluent-client/dist/types";
import { filterNoMatchReason } from "../filter/filter";
import { metricsCollector, MetricsCollectorInstance } from "../telemetry/metrics";
import { removeFinalizer } from "../finalizer";

// stores Queue instances
const queues: Record<string, Queue<KubernetesObject>> = {};

/**
 * Get the key for an entry in the queues
 *
 * @param obj The object to derive a key from
 * @returns The key to a Queue in the list of queues
 */
export function queueKey(obj: KubernetesObject): string {
  const options = ["kind", "kindNs", "kindNsName", "global"];
  const d3fault = "kind";

  let strat = process.env.PEPR_RECONCILE_STRATEGY || d3fault;
  strat = options.includes(strat) ? strat : d3fault;

  const ns = obj.metadata?.namespace ?? "cluster-scoped";
  const kind = obj.kind ?? "UnknownKind";
  const name = obj.metadata?.name ?? "Unnamed";

  const lookup: Record<string, string> = {
    kind: `${kind}`,
    kindNs: `${kind}/${ns}`,
    kindNsName: `${kind}/${ns}/${name}`,
    global: "global",
  };
  return lookup[strat];
}

export function getOrCreateQueue(obj: KubernetesObject): Queue<KubernetesObject> {
  const key = queueKey(obj);
  if (!queues[key]) {
    queues[key] = new Queue<KubernetesObject>(key);
  }
  return queues[key];
}

// Watch configuration
const watchCfg: WatchCfg = {
  resyncFailureMax: process.env.PEPR_RESYNC_FAILURE_MAX
    ? parseInt(process.env.PEPR_RESYNC_FAILURE_MAX, 10)
    : 5,
  resyncDelaySec: process.env.PEPR_RESYNC_DELAY_SECONDS
    ? parseInt(process.env.PEPR_RESYNC_DELAY_SECONDS, 10)
    : 5,
  lastSeenLimitSeconds: process.env.PEPR_LAST_SEEN_LIMIT_SECONDS
    ? parseInt(process.env.PEPR_LAST_SEEN_LIMIT_SECONDS, 10)
    : 300,
  relistIntervalSec: process.env.PEPR_RELIST_INTERVAL_SECONDS
    ? parseInt(process.env.PEPR_RELIST_INTERVAL_SECONDS, 10)
    : 600,
};

// Map the event to the watch phase
const eventToPhaseMap = {
  [Event.CREATE]: [WatchPhase.Added],
  [Event.UPDATE]: [WatchPhase.Modified],
  [Event.CREATE_OR_UPDATE]: [WatchPhase.Added, WatchPhase.Modified],
  [Event.DELETE]: [WatchPhase.Deleted],
  [Event.ANY]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
};

/**
 * Entrypoint for setting up watches for all capabilities
 *
 * @param capabilities The capabilities to load watches for
 */
export function setupWatch(capabilities: Capability[], ignoredNamespaces?: string[]): void {
  for (const capability of capabilities) {
    for (const binding of capability.bindings.filter(b => b.isWatch)) {
      runBinding(binding, capability.namespaces, ignoredNamespaces);
    }
  }
}

/**
 * Setup a watch for a binding
 *
 * @param binding the binding to watch
 * @param capabilityNamespaces list of namespaces to filter on
 */
export async function runBinding(
  binding: Binding,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): Promise<void> {
  // Get the phases to match, fallback to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.ANY];

  // The watch callback is run when an object is received or dequeued
  Log.debug({ watchCfg }, "Effective WatchConfig");

  const watchCallback = async (
    kubernetesObject: KubernetesObject,
    phase: WatchPhase,
  ): Promise<void> => {
    // First, filter the object based on the phase
    if (phaseMatch.includes(phase)) {
      try {
        // Then, check if the object matches the filter
        const filterMatch = filterNoMatchReason(
          binding,
          kubernetesObject,
          capabilityNamespaces,
          ignoredNamespaces,
        );
        if (filterMatch !== "") {
          Log.debug(filterMatch);
          return;
        }
        if (binding.isFinalize) {
          await handleFinalizerRemoval(kubernetesObject);
        } else {
          await binding.watchCallback?.(kubernetesObject, phase);
        }
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
    }
  };

  const handleFinalizerRemoval = async (kubernetesObject: KubernetesObject): Promise<void> => {
    if (!kubernetesObject.metadata?.deletionTimestamp) {
      return;
    }
    let shouldRemoveFinalizer: boolean | void | undefined = true;
    try {
      shouldRemoveFinalizer = await binding.finalizeCallback?.(kubernetesObject);

      // if not opt'ed out of / if in error state, remove pepr finalizer
    } finally {
      const peprFinal = "pepr.dev/finalizer";
      const meta = kubernetesObject.metadata!;
      const resource = `${meta.namespace || "ClusterScoped"}/${meta.name}`;

      // [ true, void, undefined ] SHOULD remove finalizer
      // [ false ] should NOT remove finalizer
      if (shouldRemoveFinalizer === false) {
        Log.debug(
          { obj: kubernetesObject },
          `Skipping removal of finalizer '${peprFinal}' from '${resource}'`,
        );
      } else {
        await removeFinalizer(binding, kubernetesObject);
      }
    }
  };

  // Setup the resource watch
  const watcher = K8s(binding.model, { ...binding.filters, kindOverride: binding.kind }).Watch(
    async (obj, phase) => {
      Log.debug(obj, `Watch event ${phase} received`);

      if (binding.isQueue) {
        const queue = getOrCreateQueue(obj);
        await queue.enqueue(obj, phase, watchCallback);
      } else {
        await watchCallback(obj, phase);
      }
    },
    watchCfg,
  );

  // Register event handlers
  try {
    registerWatchEventHandlers(watcher, logEvent, metricsCollector);
  } catch (err) {
    throw new Error(
      "WatchEventHandler Registration Error: Unable to register event watch handler.",
      { cause: err },
    );
  }

  // Start the watch
  try {
    await watcher.start();
  } catch (err) {
    throw new Error("WatchStart Error: Unable to start watch.", { cause: err });
  }
}

export function logEvent(event: WatchEvent, message: string = "", obj?: KubernetesObject): void {
  const logMessage = `Watch event ${event} received${message ? `. ${message}.` : "."}`;
  if (obj) {
    Log.debug(obj, logMessage);
  } else {
    Log.debug(logMessage);
  }
}

export type WatchEventArgs<K extends WatchEvent, T extends GenericClass> = {
  [WatchEvent.LIST]: KubernetesListObject<InstanceType<T>>;
  [WatchEvent.RECONNECT]: number;
  [WatchEvent.CACHE_MISS]: string;
  [WatchEvent.INIT_CACHE_MISS]: string;
  [WatchEvent.GIVE_UP]: Error;
  [WatchEvent.ABORT]: Error;
  [WatchEvent.OLD_RESOURCE_VERSION]: string;
  [WatchEvent.NETWORK_ERROR]: Error;
  [WatchEvent.LIST_ERROR]: Error;
  [WatchEvent.DATA_ERROR]: Error;
  [WatchEvent.CONNECT]: string;
  [WatchEvent.RECONNECT_PENDING]: undefined;
  [WatchEvent.DATA]: undefined;
  [WatchEvent.INC_RESYNC_FAILURE_COUNT]: number;
}[K];

export type LogEventFunction = (event: WatchEvent, message?: string) => void;
export function registerWatchEventHandlers(
  watcher: WatcherType<GenericClass>,
  logEvent: LogEventFunction,
  metricsCollector: MetricsCollectorInstance,
): void {
  const eventHandlers: {
    [K in WatchEvent]?: (arg: WatchEventArgs<K, GenericClass>) => void;
  } = {
    [WatchEvent.DATA]: () => null,
    [WatchEvent.GIVE_UP]: err => {
      // If failure continues, log and exit
      logEvent(WatchEvent.GIVE_UP, err.message);
      throw new Error(
        "WatchEvent GiveUp Error: The watch has failed to start after several attempts.",
        { cause: err },
      );
    },
    [WatchEvent.CONNECT]: url => logEvent(WatchEvent.CONNECT, url),
    [WatchEvent.DATA_ERROR]: err => logEvent(WatchEvent.DATA_ERROR, err.message),
    [WatchEvent.RECONNECT]: retryCount =>
      logEvent(
        WatchEvent.RECONNECT,
        `Reconnecting after ${retryCount} attempt${retryCount === 1 ? "" : "s"}`,
      ),
    [WatchEvent.RECONNECT_PENDING]: () => logEvent(WatchEvent.RECONNECT_PENDING),
    [WatchEvent.ABORT]: err => logEvent(WatchEvent.ABORT, err.message),
    [WatchEvent.OLD_RESOURCE_VERSION]: errMessage =>
      logEvent(WatchEvent.OLD_RESOURCE_VERSION, errMessage),
    [WatchEvent.NETWORK_ERROR]: err => logEvent(WatchEvent.NETWORK_ERROR, err.message),
    [WatchEvent.LIST_ERROR]: err => logEvent(WatchEvent.LIST_ERROR, err.message),
    [WatchEvent.LIST]: list => logEvent(WatchEvent.LIST, JSON.stringify(list, undefined, 2)),
    [WatchEvent.CACHE_MISS]: windowName => metricsCollector.incCacheMiss(windowName),
    [WatchEvent.INIT_CACHE_MISS]: windowName => metricsCollector.initCacheMissWindow(windowName),
    [WatchEvent.INC_RESYNC_FAILURE_COUNT]: retryCount => metricsCollector.incRetryCount(retryCount),
  };

  Object.entries(eventHandlers).forEach(([event, handler]) => {
    watcher.events.on(event, handler);
  });
}
