import { Operation } from "fast-json-patch";
import { DataOp } from "../storage";
import Log from "../logger";
import { K8s } from "kubernetes-fluent-client";
import { PeprStore } from "../k8s";
import { StatusCodes } from "http-status-codes";

// Send the cached updates to the cluster
export const flushCache = async (sendCache: Record<string, Operation>, namespace: string, name: string) => {
  const indexes = Object.keys(sendCache);
  const payload = Object.values(sendCache);

  // Loop over each key in the cache and delete it to avoid collisions with other sender calls
  Object.keys(sendCache).forEach(key => delete sendCache[key]);

  try {
    // Send the patch to the cluster
    if (payload.length > 0) {
      await K8s(PeprStore, { namespace, name }).Patch(payload);
    }
  } catch (err) {
    Log.error(err, "Pepr store update failure");

    if (err.status !== StatusCodes.UNPROCESSABLE_ENTITY) {
      // On failure to update, re-add the operations to the cache to be retried
      for (const index of indexes) {
        sendCache[index] = payload[Number(index)];
      }
    }
  }
  return sendCache;
};

// Load the sendCache with patch operations
export const fillCache = (
  sendCache: Record<string, Operation>,
  capabilityName: string,
  op: DataOp,
  key: string[],
  val?: string,
): Record<string, Operation> => {
  if (op === "add") {
    // adjust the path for the capability
    const path = `/data/${capabilityName}-${key}`;
    const value = val || "";
    const cacheIdx = [op, path, value].join(":");

    // Add the operation to the cache
    sendCache[cacheIdx] = { op, path, value };

    return sendCache;
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

    return sendCache;
  }

  // If we get here, the operation is not supported
  throw new Error(`Unsupported operation: ${op}`);
};
