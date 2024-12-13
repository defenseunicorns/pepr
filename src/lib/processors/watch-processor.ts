// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import Log from "../telemetry/logger";
import { Binding } from "../types";
import { Capability } from "../capability";
import { Event } from "../enums";
import { K8s, KubernetesObject, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { Queue } from "../queue";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { filterNoMatchReason } from "../filter/filterNoMatchReason";
import { metricsCollector } from "../telemetry/metrics";
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
  resyncFailureMax: process.env.PEPR_RESYNC_FAILURE_MAX ? parseInt(process.env.PEPR_RESYNC_FAILURE_MAX, 10) : 5,
  resyncDelaySec: process.env.PEPR_RESYNC_DELAY_SECONDS ? parseInt(process.env.PEPR_RESYNC_DELAY_SECONDS, 10) : 5,
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
  capabilities.map(capability =>
    capability.bindings
      .filter(binding => binding.isWatch)
      .forEach(bindingElement => runBinding(bindingElement, capability.namespaces, ignoredNamespaces)),
  );
}

/**
 * Setup a watch for a binding
 *
 * @param binding the binding to watch
 * @param capabilityNamespaces list of namespaces to filter on
 */
async function runBinding(
  binding: Binding,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): Promise<void> {
  // Get the phases to match, fallback to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.ANY];

  // The watch callback is run when an object is received or dequeued
  Log.debug({ watchCfg }, "Effective WatchConfig");

  const watchCallback = async (kubernetesObject: KubernetesObject, phase: WatchPhase): Promise<void> => {
    // First, filter the object based on the phase
    if (phaseMatch.includes(phase)) {
      try {
        // Then, check if the object matches the filter
        const filterMatch = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces, ignoredNamespaces);
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
      shouldRemoveFinalizer === false
        ? Log.debug({ obj: kubernetesObject }, `Skipping removal of finalizer '${peprFinal}' from '${resource}'`)
        : await removeFinalizer(binding, kubernetesObject);
    }
  };

  // Setup the resource watch
  const watcher = K8s(binding.model, binding.filters).Watch(async (obj, phase) => {
    Log.debug(obj, `Watch event ${phase} received`);

    if (binding.isQueue) {
      const queue = getOrCreateQueue(obj);
      await queue.enqueue(obj, phase, watchCallback);
    } else {
      await watchCallback(obj, phase);
    }
  }, watchCfg);

  // If failure continues, log and exit
  watcher.events.on(WatchEvent.GIVE_UP, err => {
    Log.error(err, "Watch failed after 5 attempts, giving up");
    process.exit(1);
  });

  watcher.events.on(WatchEvent.CONNECT, url => logEvent(WatchEvent.CONNECT, url));

  watcher.events.on(WatchEvent.DATA_ERROR, err => logEvent(WatchEvent.DATA_ERROR, err.message));
  watcher.events.on(WatchEvent.RECONNECT, retryCount =>
    logEvent(WatchEvent.RECONNECT, `Reconnecting after ${retryCount} attempt${retryCount === 1 ? "" : "s"}`),
  );
  watcher.events.on(WatchEvent.RECONNECT_PENDING, () => logEvent(WatchEvent.RECONNECT_PENDING));
  watcher.events.on(WatchEvent.GIVE_UP, err => logEvent(WatchEvent.GIVE_UP, err.message));
  watcher.events.on(WatchEvent.ABORT, err => logEvent(WatchEvent.ABORT, err.message));
  watcher.events.on(WatchEvent.OLD_RESOURCE_VERSION, err => logEvent(WatchEvent.OLD_RESOURCE_VERSION, err));
  watcher.events.on(WatchEvent.NETWORK_ERROR, err => logEvent(WatchEvent.NETWORK_ERROR, err.message));
  watcher.events.on(WatchEvent.LIST_ERROR, err => logEvent(WatchEvent.LIST_ERROR, err.message));
  watcher.events.on(WatchEvent.LIST, list => logEvent(WatchEvent.LIST, JSON.stringify(list, undefined, 2)));
  watcher.events.on(WatchEvent.CACHE_MISS, windowName => {
    metricsCollector.incCacheMiss(windowName);
  });

  watcher.events.on(WatchEvent.INIT_CACHE_MISS, windowName => {
    metricsCollector.initCacheMissWindow(windowName);
  });

  watcher.events.on(WatchEvent.INC_RESYNC_FAILURE_COUNT, retryCount => {
    metricsCollector.incRetryCount(retryCount);
  });

  // Start the watch
  try {
    await watcher.start();
  } catch (err) {
    Log.error(err, "Error starting watch");
    process.exit(1);
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
