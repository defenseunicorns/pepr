import { K8s } from "kubernetes-fluent-client";
import { PeprStore } from "../k8s";
import Log from "../logger";
import { Operation } from "fast-json-patch";
import { DataOp } from "../storage";

// Send the cached updates to the cluster
export const flushCache = async (migrateCache: Record<string, Operation>, namespace: string, name: string) => {
  const indexes = Object.keys(migrateCache);
  const payload = Object.values(migrateCache);

  // Loop over each key in the cache and delete it to avoid collisions with other sender calls
  for (const idx of indexes) {
    delete migrateCache[idx];
  }

  try {
    // Send the patch to the cluster
    if (payload.length > 0) {
      await K8s(PeprStore, { namespace, name: name }).Patch(payload);
    }
  } catch (err) {
    Log.error(err, "Pepr store update failure");

    if (err.status === 422) {
      Object.keys(migrateCache).forEach(key => delete migrateCache[key]);
    } else {
      // On failure to update, re-add the operations to the cache to be retried
      for (const idx of indexes) {
        migrateCache[idx] = payload[Number(idx)];
      }
    }
  }
  return migrateCache;
};

export const fillCache = (
  migrateCache: Record<string, Operation>,
  name: string,
  op: DataOp,
  key: string[],
  val?: string,
): Record<string, Operation> => {
  if (op === "add") {
    // adjust the path for the capability
    const path = `/data/${name}-v2-${key}`;
    const value = val || "";
    const cacheIdx = [op, path, value].join(":");

    // Add the operation to the cache
    migrateCache[cacheIdx] = { op, path, value };

    return migrateCache;
  }

  if (op === "remove") {
    if (key.length < 1) {
      throw new Error(`Key is required for REMOVE operation`);
    }

    for (const k of key) {
      const path = `/data/${name}-${k}`;
      const cacheIdx = [op, path].join(":");

      // Add the operation to the cache
      migrateCache[cacheIdx] = { op, path };
    }
  }

  // If we get here, the operation is not supported
  throw new Error(`Unsupported operation: ${op}`);
};
