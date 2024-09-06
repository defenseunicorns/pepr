// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { K8s, KubernetesObject, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Capability } from "./capability";
import { filterNoMatchReason } from "./helpers";
import Log from "./logger";
import { Queue } from "./queue";
import { Binding, Event } from "./types";
import { metricsCollector } from "./metrics";

// init a queueRecord record to store Queue instances for a given Kubernetes Object
const queueRecord: Record<string, Queue<KubernetesObject>> = {};

/**
 * Get the key for a record in the queueRecord
 *
 * @param obj The object to derive a key from
 * @returns The key for a Queue in the 
 */
export function queueRecordKey(obj: KubernetesObject) {
  const options = ["singular", "sharded"]; // TODO : ts-type this fella
  const d3fault = "singular";

  let strat = process.env.PEPR_RECONCILE_STRATEGY || d3fault;
  strat = options.includes(strat) ? strat : d3fault;

  const ns = obj.metadata?.namespace ?? "cluster-scoped";
  const kind = obj.kind ?? "UnknownKind";
  const name = obj.metadata?.name ?? "Unnamed";

  return strat === "singular" ? `${kind}/${ns}` : `${kind}/${name}/${ns}`;
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
  const watchCallback = async (obj: KubernetesObject, type: WatchPhase) => {
    // First, filter the object based on the phase
    Log.debug({find: "me", phaseMatch, type})
    Log.debug({find: "me", binding})
    Log.debug({find: "me", watchCallback: binding.watchCallback?.toString()})
    if (phaseMatch.includes(type)) {
      try {
        // Then, check if the object matches the filter
        const filterMatch = filterNoMatchReason(binding, obj, capabilityNamespaces);
        if (filterMatch === "") {
          await binding.watchCallback?.(obj, type);
        } else {
          Log.debug(filterMatch);
        }
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
    }
  };

  function getOrCreateQueue(key: string): Queue<KubernetesObject> {
    return queueRecord[key]
      ? queueRecord[key]
      : new Queue<KubernetesObject>(key);

    // if (!queueRecord[key]) {
    //   queueRecord[key] = new Queue<KubernetesObject>(key);

    //   // need to set this with the idea that there can be multiple, DIFFERENT
    //   //  callbacks needed for a given queue (i.e. CREATEs & DELETEs can be in
    //   //  the same queue but need to do different things)
    //   // queueRecord[key].setReconcile(watchCallback);
    // }
    // return queueRecord[key];
  }

  // Setup the resource watch
  const watcher = K8s(binding.model, binding.filters).Watch(async (obj, type) => {
    Log.debug(obj, `Watch event ${type} received`);

    const queue = getOrCreateQueue(queueRecordKey(obj));

    // If the binding is a queue, enqueue the object
    if (binding.isQueue) {
      await queue.enqueue(obj, type, watchCallback);
    } else {
      // Otherwise, run the watch callback directly
      await watchCallback(obj, type);
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

export function logEvent(type: WatchEvent, message: string = "", obj?: KubernetesObject) {
  const logMessage = `Watch event ${type} received${message ? `. ${message}.` : "."}`;
  if (obj) {
    Log.debug(obj, logMessage);
  } else {
    Log.debug(logMessage);
  }
}
