import { DataStore, Storage } from "../core/storage";
import { startsWith } from "ramda";
import Log, { redactedStore } from "../telemetry/logger";
import { K8s } from "kubernetes-fluent-client";
import { Store } from "../k8s";
import { Operation } from "fast-json-patch";
import { fillStoreCache, sendUpdatesAndFlushCache } from "./storeCache";

export interface StoreMigration {
  name: string;
  namespace: string;
  store: Store;
  stores: Record<string, Storage>;
  setupWatch: () => void;
}

export async function migrateAndSetupWatch(storeData: StoreMigration): Promise<void> {
  const { store, namespace, name, stores, setupWatch } = storeData;

  Log.debug(redactedStore(store), "Pepr Store migration");
  // Add cacheID label to store
  await K8s(Store, { namespace, name }).Patch([
    {
      op: "add",
      path: "/metadata/labels/pepr.dev-cacheID",
      value: `${Date.now()}`,
    },
  ]);

  const data: DataStore = store.data;
  let storeCache: Record<string, Operation> = {};

  for (const name of Object.keys(stores)) {
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
  storeCache = await sendUpdatesAndFlushCache(storeCache, namespace, name);
  setupWatch();
}
