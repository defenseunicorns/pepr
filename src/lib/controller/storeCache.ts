import { DataOp } from "../storage";
import Log from "../logger";
import { K8s } from "kubernetes-fluent-client";
import { PeprStore } from "../k8s";
import { StatusCodes } from "http-status-codes";
import * as ramda from "ramda";
import { Operation } from "fast-json-patch";

export const sendUpdatesAndFlushCache = async (cache: Record<string, Operation>, namespace: string, name: string) => {
  const indexes = Object.keys(cache);
  const payload = Object.values(cache);

  try {
    if (payload.length > 0) {
      await K8s(PeprStore, { namespace, name }).Patch(payload); // Send patch to cluster
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

export const migrateCacheEntryVersion = (
  oldCache: Record<string, Operation>,
  version: string,
): Record<string, Operation> => {
  let migratedCache: Record<string, Operation> = {};

  for (const [key, entry] of Object.entries(oldCache)) {
    const parts = key.split("/");
    if (parts.length < 3) continue; // Guard clause for invalid keys

    const subParts = parts[2].split("-");
    if (subParts.length < 2) continue; // Guard clause for invalid key formats

    const capabilityAndKeyName = entry.path.split("/").pop();
    const capabilityName = typeof capabilityAndKeyName === "string" ? capabilityAndKeyName.split("-")[0] : "";
    const keyName = typeof capabilityAndKeyName === "string" ? capabilityAndKeyName.split("-")[1] : "";
    let value;
    if (entry.op === "add") {
      value = entry.value;
    }

    // Check if the key is valid and not already in version 2 format
    if (
      ramda.startsWith(capabilityName, capabilityName) &&
      !ramda.startsWith(`${capabilityName}-${version}`, capabilityName)
    ) {
      migratedCache = fillStoreCache(migratedCache, capabilityName, "remove", {
        key: [keyName],
      });
      migratedCache = fillStoreCache(migratedCache, capabilityName, "add", {
        key: [keyName],
        value,
        version,
      });
    }
  }

  return migratedCache;
};
