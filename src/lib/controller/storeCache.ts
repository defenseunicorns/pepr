import { Operation } from "fast-json-patch";
import { DataOp } from "../storage";
import Log from "../logger";
import { K8s } from "kubernetes-fluent-client";
import { PeprStore } from "../k8s";
import { StatusCodes } from "http-status-codes";

export const sendUpdatesAndFlushCache = async (
  sendCache: Record<string, Operation>,
  namespace: string,
  name: string,
) => {
  const indexes = Object.keys(sendCache);
  const payload = Object.values(sendCache);

  try {
    if (payload.length > 0) {
      await K8s(PeprStore, { namespace, name }).Patch(payload); // Send the patch to the cluster
      Object.keys(sendCache).forEach(key => delete sendCache[key]); // Loop over each key in the cache and delete it to avoid collisions with other sender calls
    }
  } catch (err) {
    Log.error(err, "Pepr store update failure");

    if (err.status === StatusCodes.UNPROCESSABLE_ENTITY) {
      Object.keys(sendCache).forEach(key => delete sendCache[key]); // Loop over each key in the cache and delete it to avoid collisions with other sender calls
    } else {
      indexes.forEach(index => {
        sendCache[index] = payload[Number(index)]; // On failure to update, re-add the operations to the cache to be retried
      });
    }
  }
  return sendCache;
};

//TODO: Give this a better name
type KeyValuePair = {
  key: string[];
  value?: string; // Optional property, defaults to ""
  version?: string;
};

export const fillStoreCache = (
  sendCache: Record<string, Operation>,
  capabilityName: string,
  op: DataOp,
  kvp: KeyValuePair,
): Record<string, Operation> => {
  if (op === "add") {
    const path = [`/data/${capabilityName}`, kvp.version, kvp.key] // adjust the path, see ADR-0008
      .filter(str => str !== "" && str !== undefined)
      .join("-");
    const value = kvp.value || "";
    const cacheIdx = [op, path, value].join(":");

    // Add the operation to the cache
    sendCache[cacheIdx] = { op, path, value };
  } else if (op === "remove") {
    if (kvp.key.length < 1) {
      throw new Error(`Key is required for REMOVE operation`);
    }

    for (const k of kvp.key) {
      const path = `/data/${capabilityName}-${k}`;
      const cacheIndex = [op, path].join(":");

      // Add the operation to the cache
      sendCache[cacheIndex] = { op, path };
    }
  } else {
    throw new Error(`Unsupported operation: ${op}`);
  }
  return sendCache;
};
