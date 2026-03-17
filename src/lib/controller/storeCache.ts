import { DataOp } from "../core/storage";
import Log from "../telemetry/logger";
import { K8s } from "kubernetes-fluent-client";
import { Store } from "../k8s";
import { StatusCodes } from "http-status-codes";
import { Operation } from "fast-json-patch";

export const sendUpdatesAndFlushCache = async (
  cache: Record<string, Operation>,
  namespace: string,
  name: string,
): Promise<Record<string, Operation>> => {
  const indexes = Object.keys(cache);
  const payload = Object.values(cache);

  try {
    if (payload.length > 0) {
      await K8s(Store, { namespace, name }).Patch(updateCacheID(payload)); // Send patch to cluster
      Object.keys(cache).forEach(key => delete cache[key]);
    }
  } catch (err) {
    Log.error(err, "Pepr store update failure");

    if (err.status === StatusCodes.UNPROCESSABLE_ENTITY) {
      Object.keys(cache).forEach(key => delete cache[key]);
    } else {
      indexes.forEach(index => {
        cache[index] = payload[Number(index)]; // On failure to update, re-add the operations to the cache to be retried
      });
    }
  }
  return cache;
};

type CacheItem = {
  key: string[];
  value?: string;
  version?: string;
};

export const fillStoreCache = (
  cache: Record<string, Operation>,
  capabilityName: string,
  op: DataOp,
  cacheItem: CacheItem,
): Record<string, Operation> => {
  if (op === "add") {
    if (cacheItem.key.length !== 1) {
      throw new Error(`ADD operation expects exactly one key, got ${cacheItem.key.length}`);
    }
    const path = [`/data/${capabilityName}`, cacheItem.version, cacheItem.key[0]] // adjust the path, see ADR-0008
      .filter(str => str !== "" && str !== undefined)
      .join("-");
    const value = cacheItem.value || "";
    const cacheIdx = [op, path, value].join(":");

    // Add the operation to the cache
    cache[cacheIdx] = { op, path, value };
  } else if (op === "remove") {
    if (cacheItem.key.length < 1) {
      throw new Error(`Key is required for REMOVE operation`);
    }
    // Produce one remove operation per key. Storage.clear() passes all store
    // keys in a single dispatch; each needs its own JSON Patch entry.
    for (const key of cacheItem.key) {
      const path = [`/data/${capabilityName}`, cacheItem.version, key]
        .filter(str => str !== "" && str !== undefined)
        .join("-");
      const cacheIndex = [op, path].join(":");
      cache[cacheIndex] = { op, path };
    }
  } else {
    throw new Error(`Unsupported operation: ${op}`);
  }
  return cache;
};

export function updateCacheID(payload: Operation[]): Operation[] {
  payload.push({
    op: "replace",
    path: "/metadata/labels/pepr.dev-cacheID",
    value: `${Date.now()}`,
  });
  return payload;
}
