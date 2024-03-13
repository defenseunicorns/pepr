// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { createHash } from "crypto";
import { K8s, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Queue } from "./queue";
import { Capability } from "./capability";
import Log from "./logger";
import { Binding, Event } from "./types";
import { Watcher } from "kubernetes-fluent-client/dist/fluent/watch";
import { GenericClass } from "kubernetes-fluent-client";
import { filterMatcher } from "./helpers";

const store: Record<string, string> = {};

export function setupWatch(capabilities: Capability[]) {
  capabilities.map(capability =>
    capability.bindings
      .filter(binding => binding.isWatch)
      .forEach(bindingElement => runBinding(bindingElement, capability.namespaces)),
  );
}

async function runBinding(binding: Binding, capabilityNamespaces: string[]) {
  // Map the event to the watch phase
  const eventToPhaseMap = {
    [Event.Create]: [WatchPhase.Added],
    [Event.Update]: [WatchPhase.Modified],
    [Event.CreateOrUpdate]: [WatchPhase.Added, WatchPhase.Modified],
    [Event.Delete]: [WatchPhase.Deleted],
    [Event.Any]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
  };

  // Get the phases to match, default to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.Any];

  const watchCfg: WatchCfg = {
    retryMax: 5,
    retryDelaySec: 5,
  };

  let watcher: Watcher<GenericClass>;
  if (binding.isQueue) {
    const queue = new Queue();
    // Watch the resource
    watcher = K8s(binding.model, binding.filters).Watch(async (obj, type) => {
      Log.debug(obj, `Watch event ${type} received`);

      // If the type matches the phase, call the watch callback
      if (phaseMatch.includes(type)) {
        try {
          const filterMatch = filterMatcher(binding, obj, capabilityNamespaces);
          if (filterMatch === "") {
            queue.setReconcile(async () => await binding.watchCallback?.(obj, type));
            // Enqueue the object for reconciliation through callback
            await queue.enqueue(obj);
          } else {
            Log.debug(filterMatch);
          }
        } catch (e) {
          // Errors in the watch callback should not crash the controller
          Log.error(e, "Error executing watch callback");
        }
      }
    }, watchCfg);
  } else {
    // Watch the resource
    watcher = K8s(binding.model, binding.filters).Watch(async (obj, type) => {
      Log.debug(obj, `Watch event ${type} received`);

      // If the type matches the phase, call the watch callback
      if (phaseMatch.includes(type)) {
        try {
          const filterMatch = filterMatcher(binding, obj, capabilityNamespaces);
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
    }, watchCfg);
  }

  // Create a unique cache ID for this watch binding in case multiple bindings are watching the same resource
  const cacheSuffix = createHash("sha224").update(binding.watchCallback!.toString()).digest("hex").substring(0, 5);
  const cacheID = [watcher.getCacheID(), cacheSuffix].join("-");

  // If failure continues, log and exit
  watcher.events.on(WatchEvent.GIVE_UP, err => {
    Log.error(err, "Watch failed after 5 attempts, giving up");
    process.exit(1);
  });

  // Start the watch
  try {
    const resourceVersion = store[cacheID];
    if (resourceVersion) {
      Log.debug(`Starting watch ${binding.model.name} from version ${resourceVersion}`);
      watcher.resourceVersion = resourceVersion;
    }

    await watcher.start();
  } catch (err) {
    Log.error(err, "Error starting watch");
    process.exit(1);
  }
}
