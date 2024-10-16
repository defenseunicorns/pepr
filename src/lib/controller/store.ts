// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { K8s } from "kubernetes-fluent-client";
import * as ramda from "ramda";

import { Capability } from "../capability";
import { PeprStore } from "../k8s";
import Log from "../logger";
import { DataOp, DataSender, DataStore, Storage } from "../storage";
import { fillCache, flushCache } from "./migrateCache";

export const redactedValue = "**redacted**";
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

    const setStorageInstance = (registrationFunction: () => Storage, name: string) => {
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
        K8s(PeprStore)
          .InNamespace(namespace)
          .Get(this.#name)
          // If the get succeeds, migrate and setup the watch
          .then(async (store: PeprStore) => await this.#migrateAndSetupWatch(store))
          // Otherwise, create the resource
          .catch(this.#createStoreResource),
      Math.random() * 3000, // Add a jitter to the Store creation to avoid collisions
    );
  }

  #setupWatch = () => {
    const watcher = K8s(PeprStore, { name: this.#name, namespace }).Watch(this.#receive);
    watcher.start().catch(e => Log.error(e, "Error starting Pepr store watch"));
  };

  #migrateAndSetupWatch = async (store: PeprStore) => {
    Log.debug(redactedStore(store), "Pepr Store migration");
    const data: DataStore = store.data || {};
    let migrateCache: Record<string, Operation> = {};

    for (const name of Object.keys(this.#stores)) {
      // Get the prefix offset for the keys
      const offset = `${name}-`.length;

      // Loop over each key in the store
      for (const key of Object.keys(data)) {
        // Match on the capability name as a prefix for non v2 keys
        if (ramda.startsWith(name, key) && !ramda.startsWith(`${name}-v2`, key)) {
          // populate migrate cache
          migrateCache = fillCache(migrateCache, name, "remove", [key.slice(offset)], data[key]);
          migrateCache = fillCache(migrateCache, name, "add", [key.slice(offset)], data[key]);
        }
      }
    }
    migrateCache = await flushCache(migrateCache, namespace, this.#name);
    this.#setupWatch();
  };

  #receive = (store: PeprStore) => {
    Log.debug(redactedStore(store), "Pepr Store update");

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
          if (ramda.startsWith(name, key)) {
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
    this.#sendDebounce = setTimeout(debounced, this.#onReady ? 0 : debounceBackoff);
  };

  #send = (capabilityName: string) => {
    let sendCache: Record<string, Operation> = {};

    // Create a sender function for the capability to add/remove data from the store
    const sender: DataSender = async (op: DataOp, key: string[], val?: string) => {
      sendCache = fillCache(sendCache, capabilityName, op, key, val);
    };

    // Send any cached updates every debounceBackoff milliseconds
    setInterval(() => {
      if (Object.keys(sendCache).length > 0) {
        Log.debug(redactedPatch(sendCache), "Sending updates to Pepr store");
        void flushCache(sendCache, namespace, this.#name);
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

export function redactedStore(store: PeprStore): PeprStore {
  const redacted = process.env.PEPR_STORE_REDACT_VALUES === "true";
  return {
    ...store,
    data: Object.keys(store.data).reduce((acc: Record<string, string>, key: string) => {
      acc[key] = redacted ? redactedValue : store.data[key];
      return acc;
    }, {}),
  };
}

export function redactedPatch(patch: Record<string, Operation> = {}): Record<string, Operation> {
  const redacted = process.env.PEPR_STORE_REDACT_VALUES === "true";

  if (!redacted) {
    return patch;
  }

  const redactedCache: Record<string, Operation> = {};

  Object.keys(patch).forEach(key => {
    const operation = patch[key];
    const redactedKey = key.includes(":") ? key.substring(0, key.lastIndexOf(":")) + ":**redacted**" : key;
    const redactedOperation: Operation = {
      ...operation,
      ...("value" in operation ? { value: redactedValue } : {}),
    };
    redactedCache[redactedKey] = redactedOperation;
  });

  return redactedCache;
}
