// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { K8s, KubernetesObject, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Capability } from "./capability";
import { filterNoMatchReason } from "./helpers";
import Log from "./logger";
import { Queue } from "./queue";
import { Binding, Event } from "./types";

// Watch configuration
const watchCfg: WatchCfg = {
  retryMax: process.env.PEPR_RETRYMAX ? parseInt(process.env.PEPR_RETRYMAX, 10) : 5,
  retryDelaySec: process.env.PEPR_RETRYDELAYSECONDS ? parseInt(process.env.PEPR_RETRYDELAYSECONDS, 10) : 5,
  resyncIntervalSec: process.env.PEPR_RESYNCINTERVALSECONDS
    ? parseInt(process.env.PEPR_RESYNCINTERVALSECONDS, 10)
    : 300,
  allowWatchBookmarks: process.env.PEPR_ALLOWWATCHBOOKMARKS === "false" ? false : true
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

  const queue = new Queue();
  queue.setReconcile(watchCallback);

  // Setup the resource watch
  const watcher = K8s(binding.model, binding.filters).Watch(async (obj, type) => {
    Log.debug(obj, `Watch event ${type} received`);

    // If the binding is a queue, enqueue the object
    if (binding.isQueue) {
      try {
        await queue.enqueue(obj, type);
      }catch (e) {
        console.log(e, "ERRRORRRRR!!!!")
      }

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

  watcher.events.on(WatchEvent.CONNECT, () => logEvent(WatchEvent.CONNECT));

  watcher.events.on(WatchEvent.BOOKMARK, obj =>
    logEvent(WatchEvent.BOOKMARK, "Changes up to the given resourceVersion have been sent.", obj),
  );

  watcher.events.on(WatchEvent.DATA_ERROR, err => logEvent(WatchEvent.DATA_ERROR, err.message));
  watcher.events.on(WatchEvent.RESOURCE_VERSION, resourceVersion =>
    logEvent(WatchEvent.RESOURCE_VERSION, `Resource version: ${resourceVersion}`),
  );
  watcher.events.on(WatchEvent.RECONNECT, (err, retryCount) =>
    logEvent(WatchEvent.RECONNECT, `Reconnecting after ${retryCount} attempts`, err),
  );
  watcher.events.on(WatchEvent.RECONNECT_PENDING, () => logEvent(WatchEvent.RECONNECT_PENDING));
  watcher.events.on(WatchEvent.GIVE_UP, err => logEvent(WatchEvent.GIVE_UP, err.message));
  watcher.events.on(WatchEvent.ABORT, err => logEvent(WatchEvent.ABORT, err.message));
  watcher.events.on(WatchEvent.OLD_RESOURCE_VERSION, err => logEvent(WatchEvent.OLD_RESOURCE_VERSION, err));
  watcher.events.on(WatchEvent.RESYNC, err => logEvent(WatchEvent.RESYNC, err.message));
  watcher.events.on(WatchEvent.NETWORK_ERROR, err => logEvent(WatchEvent.NETWORK_ERROR, err.message));

  // Start the watch
  try {
    await watcher.start();
  } catch (err) {
    Log.error(err, "Error starting watch");
    process.exit(1);
  }
}

export function logEvent(type: WatchEvent, message: string = "", obj?: KubernetesObject) {
  if (obj) {
    Log.debug(obj, `Watch event ${type} received: %s`, message);
  } else {
    Log.debug(`Watch event ${type} received: %s`, message);
  }
}
