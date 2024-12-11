// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { K8s } from "kubernetes-fluent-client";
import { startsWith } from "ramda";

import { Capability } from "../capability";
import { Store } from "../k8s";
import Log, { redactedPatch, redactedStore } from "../telemetry/logger";
import { DataOp, DataSender, DataStore, Storage } from "../storage";
import { fillStoreCache, sendUpdatesAndFlushCache } from "./storeCache";

const namespace = "pepr-system";
const debounceBackoffReceive = 1000;
const debounceBackoffSend = 4000;

export class StoreController {
  #name: string;
  #stores: Record<string, Storage> = {};
  #sendDebounce: NodeJS.Timeout | undefined;
  #onReady?: () => void;

  constructor(capabilities: Capability[], name: string, onReady?: () => void) {
    this.#onReady = onReady;

    this.#name = name;

    const setStorageInstance = (registrationFunction: () => Storage, name: string): void => {
      const scheduleStore = registrationFunction();

      // Bind the store sender to the capability
      scheduleStore.registerSender(this.#send(name));

      // Store the storage instance
      this.#stores[name] = scheduleStore;
    };

    if (name.includes("schedule")) {
      // Establish the store for each capability
      for (const { name, registerScheduleStore, hasSchedule } of capabilities) {
        if (hasSchedule === true) {
          // Register the scheduleStore with the capability
          setStorageInstance(registerScheduleStore, name);
        }
      }
    } else {
      // Establish the store for each capability
      for (const { name, registerStore } of capabilities) {
        setStorageInstance(registerStore, name);
      }
    }

    setTimeout(
      () =>
        K8s(Store)
          .InNamespace(namespace)
          .Get(this.#name)
          .then(async (store: Store) => await this.#migrateAndSetupWatch(store))
          .catch(this.#createStoreResource),
      Math.random() * 3000, // Add a jitter to the Store creation to avoid collisions
    );
  }

  #setupWatch = (): void => {
    const watcher = K8s(Store, { name: this.#name, namespace }).Watch(this.#receive);
    watcher.start().catch(e => Log.error(e, "Error starting Pepr store watch"));
  };

  #migrateAndSetupWatch = async (store: Store): Promise<void> => {
    Log.debug(redactedStore(store), "Pepr Store migration");
    const data: DataStore = store.data || {};
    let storeCache: Record<string, Operation> = {};

    for (const name of Object.keys(this.#stores)) {
      // Get the prefix offset for the keys
      const offset = `${name}-`.length;

      // Loop over each key in the store
      for (const key of Object.keys(data)) {
        // Match on the capability name as a prefix for non v2 keys
        if (startsWith(name, key) && !startsWith(`${name}-v2`, key)) {
          // populate migrate cache
          storeCache = fillStoreCache(storeCache, name, "remove", {
            key: [key.slice(offset)],
            value: data[key],
          });
          storeCache = fillStoreCache(storeCache, name, "add", {
            key: [key.slice(offset)],
            value: data[key],
            version: "v2",
          });
        }
      }
    }
    storeCache = await sendUpdatesAndFlushCache(storeCache, namespace, this.#name);
    this.#setupWatch();
  };

  #receive = (store: Store): void => {
    Log.debug(redactedStore(store), "Pepr Store update");

    // Wrap the update in a debounced function
    const debounced = (): void => {
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
    this.#sendDebounce = setTimeout(debounced, this.#onReady ? 0 : debounceBackoffReceive);
  };

  #send = (capabilityName: string): DataSender => {
    let storeCache: Record<string, Operation> = {};

    // Create a sender function for the capability to add/remove data from the store
    const sender: DataSender = async (op: DataOp, key: string[], value?: string) => {
      storeCache = fillStoreCache(storeCache, capabilityName, op, { key, value });
    };

    // Send any cached updates every debounceBackoff milliseconds
    setInterval(() => {
      if (Object.keys(storeCache).length > 0) {
        Log.debug(redactedPatch(storeCache), "Sending updates to Pepr store");
        void sendUpdatesAndFlushCache(storeCache, namespace, this.#name);
      }
    }, debounceBackoffSend);

    return sender;
  };

  #createStoreResource = async (e: unknown): Promise<void> => {
    Log.info(`Pepr store not found, creating...`);
    Log.debug(e);

    try {
      await K8s(Store).Apply({
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
