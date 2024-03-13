// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { K8s } from "kubernetes-fluent-client";
import { startsWith } from "ramda";

import { Capability } from "../capability";
import { PeprStore } from "../k8s";
import Log from "../logger";
import { DataOp, DataSender, DataStore, Storage } from "../storage";

const namespace = "pepr-system";
export const debounceBackoff = 5000;

export class PeprControllerStore {
  #name: string;
  #stores: Record<string, Storage> = {};
  #sendDebounce: NodeJS.Timeout | undefined;
  #onReady?: () => void;

  constructor(capabilities: Capability[], name: string, onReady?: () => void) {
    this.#onReady = onReady;

    // Setup Pepr State bindings
    this.#name = name;

    if (name.includes("schedule")) {
      // Establish the store for each capability
      for (const { name, registerScheduleStore, hasSchedule } of capabilities) {
        // Guard Clause to exit  early
        if (hasSchedule !== true) {
          continue;
        }
        // Register the scheduleStore with the capability
        const { scheduleStore } = registerScheduleStore();

        // Bind the store sender to the capability
        scheduleStore.registerSender(this.#send(name));

        // Store the storage instance
        this.#stores[name] = scheduleStore;
      }
    } else {
      // Establish the store for each capability
      for (const { name, registerStore } of capabilities) {
        // Register the store with the capability
        const { store } = registerStore();

        // Bind the store sender to the capability
        store.registerSender(this.#send(name));

        // Store the storage instance
        this.#stores[name] = store;
      }
    }

    // Add a jitter to the Store creation to avoid collisions
    setTimeout(
      () =>
        K8s(PeprStore)
          .InNamespace(namespace)
          .Get(this.#name)
          // If the get succeeds, setup the watch
          .then(this.#setupWatch)
          // Otherwise, create the resource
          .catch(this.#createStoreResource),
      Math.random() * 3000,
    );
  }

  #setupWatch = () => {
    const watcher = K8s(PeprStore, { name: this.#name, namespace }).Watch(this.#receive);
    watcher.start().catch(e => Log.error(e, "Error starting Pepr store watch"));
  };

  #receive = (store: PeprStore) => {
    Log.debug(store, "Pepr Store update");

    // Wrap the update in a debounced function
    const debounced = () => {
      // Base64 decode the data
      const data: DataStore = store.data || {};

      // Loop over each stored capability
      for (const name of Object.keys(this.#stores)) {
        // Get the prefix offset for the keys
        const offset = `${name}-`.length;

        // Get any keys that match the capability name prefix
        const filtered: DataStore = {};

        // Loop over each key in the secret
        for (const key of Object.keys(data)) {
          // Match on the capability name as a prefix
          if (startsWith(name, key)) {
            // Strip the prefix and store the value
            filtered[key.slice(offset)] = data[key];
          }
        }

        // Send the data to the receiver callback
        this.#stores[name].receive(filtered);
      }

      // Call the onReady callback if this is the first time the secret has been read
      if (this.#onReady) {
        this.#onReady();
        this.#onReady = undefined;
      }
    };

    // Debounce the update to 1 second to avoid multiple rapid calls
    clearTimeout(this.#sendDebounce);
    this.#sendDebounce = setTimeout(debounced, debounceBackoff);
  };

  #send = (capabilityName: string) => {
    const sendCache: Record<string, Operation> = {};

    // Load the sendCache with patch operations
    const fillCache = (op: DataOp, key: string[], val?: string) => {
      if (op === "add") {
        const path = `/data/${capabilityName}-${key}`;
        const value = val || "";
        const cacheIdx = [op, path, value].join(":");

        // Add the operation to the cache
        sendCache[cacheIdx] = { op, path, value };

        return;
      }

      if (op === "remove") {
        if (key.length < 1) {
          throw new Error(`Key is required for REMOVE operation`);
        }

        for (const k of key) {
          const path = `/data/${capabilityName}-${k}`;
          const cacheIdx = [op, path].join(":");

          // Add the operation to the cache
          sendCache[cacheIdx] = { op, path };
        }

        return;
      }

      // If we get here, the operation is not supported
      throw new Error(`Unsupported operation: ${op}`);
    };

    // Send the cached updates to the cluster
    const flushCache = async () => {
      const indexes = Object.keys(sendCache);
      const payload = Object.values(sendCache);

      // Loop over each key in the cache and delete it to avoid collisions with other sender calls
      for (const idx of indexes) {
        delete sendCache[idx];
      }

      try {
        // Send the patch to the cluster
        await K8s(PeprStore, { namespace, name: this.#name }).Patch(payload);
      } catch (err) {
        Log.error(err, "Pepr store update failure");

        // On failure to update, re-add the operations to the cache to be retried
        for (const idx of indexes) {
          sendCache[idx] = payload[Number(idx)];
        }
      }
    };

    // Create a sender function for the capability to add/remove data from the store
    const sender: DataSender = async (op: DataOp, key: string[], val?: string) => {
      fillCache(op, key, val);
    };

    // Send any cached updates every debounceBackoff milliseconds
    setInterval(() => {
      if (Object.keys(sendCache).length > 0) {
        Log.debug(sendCache, "Sending updates to Pepr store");
        void flushCache();
      }
    }, debounceBackoff);

    return sender;
  };

  #createStoreResource = async (e: unknown) => {
    Log.info(`Pepr store not found, creating...`);
    Log.debug(e);

    try {
      await K8s(PeprStore).Apply({
        metadata: {
          name: this.#name,
          namespace,
        },
        data: {
          // JSON Patch will die if the data is empty, so we need to add a placeholder
          __pepr_do_not_delete__: "k-thx-bye",
        },
      });

      // Now that the resource exists, setup the watch
      this.#setupWatch();
    } catch (err) {
      Log.error(err, "Failed to create Pepr store");
    }
  };
}
