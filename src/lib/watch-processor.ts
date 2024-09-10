// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { K8s, kind, KubernetesObject, RegisterKind, GroupVersionKind, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Capability } from "./capability";
import { filterNoMatchReason } from "./helpers";
import Log from "./logger";
import { Queue } from "./queue";
import { Binding, Event } from "./types";
import { metricsCollector } from "./metrics";

// stores Queue instances
const queues: Record<string, Queue<KubernetesObject>> = {};

// default + dynamically-registered Kinds
let kinds = kind;

/**
 * Get the key for an entry in the queues
 *
 * @param obj The object to derive a key from
 * @returns The key to a Queue in the list of queues
 */
export function queueKey(obj: KubernetesObject) {
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

export function getOrCreateQueue(obj: KubernetesObject) {
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
  [Event.Create]: [WatchPhase.Added],
  [Event.Update]: [WatchPhase.Modified],
  [Event.CreateOrUpdate]: [WatchPhase.Added, WatchPhase.Modified],
  [Event.Delete]: [WatchPhase.Deleted],
  [Event.Any]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
};

/**
 * Entrypoint for setting up watches for all capabilities
 *
 * @param capabilities The capabilities to load watches for
 */
export function setupWatch(capabilities: Capability[]) {
  capabilities.map(capability =>
    capability.bindings
      .filter(binding => binding.isWatch)
      .forEach(bindingElement => runBinding(bindingElement, capability.namespaces)),
  );
}

/**
 * Setup a watch for a binding
 *
 * @param binding the binding to watch
 * @param capabilityNamespaces list of namespaces to filter on
 */
async function runBinding(binding: Binding, capabilityNamespaces: string[]) {
  // Get the phases to match, fallback to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.Any];

  // The watch callback is run when an object is received or dequeued
  Log.debug({ watchCfg }, "Effective WatchConfig");

  const watchCallback = async (obj: KubernetesObject, phase: WatchPhase) => {
    // First, filter the object based on the phase
    if (phaseMatch.includes(phase)) {
      try {

        // Then, check if the object matches the filter
        const filterMatch = filterNoMatchReason(binding, obj, capabilityNamespaces);
        if (filterMatch === "") {
          if (binding.isFinalize) {
            // if there's no deletionTimestamp, don't run finalizer callback
            if (! obj.metadata?.deletionTimestamp) { return }

            // run the finalizer callback
            try {
              await binding.finalizeCallback?.(obj);
            }

            // irrespective of callback success or failure, remove pepr finalizer
            finally {

              // ensure request model is registerd with KFC (non-built in CRD's, etc.)
              const { model, kind } = binding;
              try {
                RegisterKind(model, kind);
              } catch (e) {
                const expected = e.message === `GVK ${model.name} already registered`
                if (!expected) { throw e }
              }

              // look up index of pepr finalizer
              let finalizer = "pepr-finalizer";
              let idx = obj?.metadata?.finalizers?.indexOf(finalizer) || -1;
              if (idx < 0) {
                let err = `Can't find finalizer: ${finalizer}.`;
                Log.error({ obj, finalizer }, err);
                throw err;
              }
// TODO: left-off here!
              // JSON Patch - remove item from array
              // https://datatracker.ietf.org/doc/html/rfc6902/#appendix-A.4
              await K8s(model, {
                namespace: obj.metadata.namespace,
                name: obj.metadata.name,
              }).Patch([{
                op: "remove",
                path: `/metadata/finalizers/${idx}`
              }]);
            }

          } else {
            await binding.watchCallback?.(obj, phase);
          }

        } else {
          Log.debug(filterMatch);
        }
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
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

export function logEvent(event: WatchEvent, message: string = "", obj?: KubernetesObject) {
  const logMessage = `Watch event ${event} received${message ? `. ${message}.` : "."}`;
  if (obj) {
    Log.debug(obj, logMessage);
  } else {
    Log.debug(logMessage);
  }
}
