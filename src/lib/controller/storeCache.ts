import { DataOp } from "../core/storage";
import Log from "../telemetry/logger";
import { K8s } from "kubernetes-fluent-client";
import { Store } from "../k8s";
import { StatusCodes } from "http-status-codes";
import { Operation } from "kubernetes-fluent-client";

export const sendUpdatesAndFlushCache = async (
  cache: Record<string, Operation>,
  namespace: string,
  name: string,
): Promise<Record<string, Operation>> => {
  // Snapshot the cache before the flush attempt so we can restore it on retryable failure.
  const snapshot = { ...cache };
  const payload = Object.values(snapshot);

  try {
    if (payload.length > 0) {
      await K8s(Store, { namespace, name }).Patch(updateCacheID(payload)); // Send patch to cluster
      Object.keys(snapshot).forEach(key => delete cache[key]);
    }
  } catch (err) {
    Log.error(err, "Pepr store update failure");

    if (err.status === StatusCodes.UNPROCESSABLE_ENTITY) {
      Object.keys(snapshot).forEach(key => delete cache[key]);
    } else {
      // Restore only entries that were removed during the flush attempt,
      // preserving any concurrent writes from sender() for colliding keys.
      restoreMissing(cache, snapshot);
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
  const path = [`/data/${capabilityName}`, cacheItem.version, cacheItem.key] // adjust the path, see ADR-0008
    .filter(str => str !== "" && str !== undefined)
    .join("-");
  if (op === "add") {
    const value = cacheItem.value || "";
    const cacheIdx = [op, path, value].join(":");

    // Add the operation to the cache
    cache[cacheIdx] = { op, path, value };
  } else if (op === "remove") {
    if (cacheItem.key.length < 1) {
      throw new Error(`Key is required for REMOVE operation`);
    }
    const cacheIndex = [op, path].join(":");
    // Add the operation to the cache
    cache[cacheIndex] = { op, path };
  } else {
    throw new Error(`Unsupported operation: ${op}`);
  }
  return cache;
};

/** Copy entries from `source` into `target`, skipping keys that already exist in `target`. */
function restoreMissing(
  target: Record<string, Operation>,
  source: Record<string, Operation>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) {
      target[key] = value;
    }
  }
}

export function updateCacheID(payload: Operation[]): Operation[] {
  payload.push({
    op: "replace",
    path: "/metadata/labels/pepr.dev-cacheID",
    value: `${Date.now()}`,
  });
  return payload;
}
