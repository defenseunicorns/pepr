// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { createHash } from "crypto";
import { K8s, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";

import { Capability } from "./capability";
import { PeprStore } from "./k8s";
import Log from "./logger";
import { Binding, Event } from "./types";

// Track if the store has been updated
let storeUpdates = false;

const store: Record<string, string> = {};

export async function setupStore(uuid: string) {
  const name = `pepr-${uuid}-watch`;
  const namespace = "pepr-system";

  try {
    // Try to read the watch store if it exists
    const k8sStore = await K8s(PeprStore).InNamespace(namespace).Get(name);

    // Iterate over the store and add the values to the local store
    Object.entries(k8sStore.data).forEach(([key, value]) => {
      store[key] = value;
    });
  } catch (e) {
    // A store not existing is expected behavior on the first run
    Log.debug(e, "Watch store does not exist yet");
  }

  // Update the store every 10 seconds if there are changes
  setInterval(() => {
    if (storeUpdates) {
      K8s(PeprStore)
        .Apply({
          metadata: {
            name,
            namespace,
          },
          data: store,
        })
        // Reset the store updates flag
        .then(() => (storeUpdates = false))
        // Log the error if the store update fails, but don't reset the store updates flag
        .catch(e => {
          Log.error(e, "Error updating watch store");
        });
    }
  }, 10 * 1000);
}

export async function setupWatch(uuid: string, capabilities: Capability[]) {
  await setupStore(uuid);

  capabilities
    .flatMap(c => c.bindings)
    .filter(binding => binding.isWatch)
    .forEach(runBinding);
}

async function runBinding(binding: Binding) {
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

  // Watch the resource
  const watcher = K8s(binding.model, binding.filters).Watch(async (obj, type) => {
    Log.debug(obj, `Watch event ${type} received`);

    // If the type matches the phase, call the watch callback
    if (phaseMatch.includes(type)) {
      try {
        // Perform the watch callback
        await binding.watchCallback?.(obj, type);
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
    }
  }, watchCfg);

  // Create a unique cache ID for this watch binding in case multiple bindings are watching the same resource
  const cacheSuffix = createHash("sha224").update(binding.watchCallback!.toString()).digest("hex").substring(0, 5);
  const cacheID = [watcher.getCacheID(), cacheSuffix].join("-");

  // Track the resource version in the local store
  watcher.events.on(WatchEvent.RESOURCE_VERSION, version => {
    Log.debug(`Received watch cache: ${cacheID}:${version}`);
    if (store[cacheID] !== version) {
      Log.debug(`Updating watch cache: ${cacheID}: ${store[cacheID]} => ${version}`);
      store[cacheID] = version;
      storeUpdates = true;
    }
  });

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
