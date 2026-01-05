// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import Log from "../telemetry/logger";
import { Binding } from "../types";
import { Capability } from "../core/capability";
import { Event } from "../enums";
import {
  KubernetesObject,
  WatchCfg,
    WatchEvent,
  GenericClass,
  modelToGroupVersionKind,
} from "kubernetes-fluent-client";
import { KubernetesListObject } from "kubernetes-fluent-client/dist/types";
import { Queue } from "../core/queue";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { filterNoMatchReason } from "../filter/filter";
import { removeFinalizer } from "../finalizer";

import { credentials } from "@grpc/grpc-js";
import {
  WatchServiceClient,
  WatchRequest,
  WatchResponse,
  EventType,
} from "../../api/apiv1";

export type WatchType = {
  group: string;
  version?: string;
  resource: string;
  namespace?: string;
};

// stores Queue instances
const queues: Record<string, Queue<KubernetesObject>> = {};

// gRPC client configuration
const GRPC_SERVER_ADDRESS = process.env.PEPR_GRPC_SERVER_ADDRESS || "localhost:50051";
let grpcClient: WatchServiceClient | null = null;

// Track active streams for cleanup + de-dupe
const activeStreams: Map<string, any> = new Map();

// Track reconnect attempt state per streamKey
const reconnectAttempts: Map<string, number> = new Map();
const reconnectTimers: Map<string, any> = new Map();
const reconnecting: Set<string> = new Set();

// Track last seen resourceVersion per streamKey (used for resume on reconnect)
const lastSeenRV: Map<string, string> = new Map();

/**
 * Initialize the gRPC client connection
 */
function getGrpcClient(): WatchServiceClient {
  if (!grpcClient) {
    Log.info(`Attempting to connect to gRPC server at ${GRPC_SERVER_ADDRESS}`);
    try {
      grpcClient = new WatchServiceClient(GRPC_SERVER_ADDRESS, credentials.createInsecure());
      Log.info(`gRPC client created successfully for ${GRPC_SERVER_ADDRESS}`);
    } catch (error) {
      Log.error(error, `Failed to create gRPC client for ${GRPC_SERVER_ADDRESS}`);
      throw error;
    }
  }
  return grpcClient;
}

/**
 * Cleanup all gRPC connections and streams
 */
export function cleanupGrpcConnections(): void {
  Log.info("Cleaning up gRPC connections and streams");

  // Cancel all reconnect timers
  reconnectTimers.forEach((timer, key) => {
    try {
      clearTimeout(timer);
      Log.debug(`Cleared reconnect timer: ${key}`);
    } catch (e) {
      Log.error(e, `Error clearing reconnect timer: ${key}`);
    }
  });
  reconnectTimers.clear();
  reconnectAttempts.clear();
  reconnecting.clear();

  // Cancel all active streams
  activeStreams.forEach((stream, key) => {
    try {
      stream.cancel();
      Log.debug(`Cancelled gRPC stream: ${key}`);
    } catch (error) {
      Log.error(error, `Error cancelling gRPC stream: ${key}`);
    }
  });
  activeStreams.clear();

  // Close gRPC client
  if (grpcClient) {
    try {
      grpcClient.close();
      grpcClient = null;
      Log.info("gRPC client connection closed");
    } catch (error) {
      Log.error(error, "Error closing gRPC client");
    }
  }
}

/**
 * Map EventType from protobuf to WatchPhase
 */
function eventTypeToWatchPhase(eventType: EventType): WatchPhase | null {
  switch (eventType) {
    case EventType.ADDED:
      return WatchPhase.Added;
    case EventType.MODIFIED:
      return WatchPhase.Modified;
    case EventType.DELETED:
      return WatchPhase.Deleted;
    default:
      return null;
  }
}

/**
 * Get the key for an entry in the queues
 */
export function queueKey(obj: KubernetesObject): string {
  const options = ["kind", "kindNs", "kindNsName", "global"];
  const d3fault = "kindNsName";

  let strat = process.env.PEPR_RECONCILE_STRATEGY || d3fault;
  strat = options.includes(strat) ? strat : d3fault;

  const ns = obj.metadata?.namespace ?? "cluster-scoped";
  const kind = obj.kind ?? "UnknownKind";
  const name = obj.metadata?.name ?? "Unnamed";

  const lookup: Record<string, string> = {
    kind: `${kind}`,
    kindNs: `${kind}/${ns}`,
    kindNsName: `${kind}/${ns}/${name}`,
    global: "global",
  };
  return lookup[strat];
}

export function getOrCreateQueue(obj: KubernetesObject): Queue<KubernetesObject> {
  const key = queueKey(obj);
  if (!queues[key]) {
    queues[key] = new Queue<KubernetesObject>(key);
  }
  return queues[key];
}

// Watch configuration
const watchCfg: WatchCfg = {
  resyncFailureMax: process.env.PEPR_RESYNC_FAILURE_MAX ? parseInt(process.env.PEPR_RESYNC_FAILURE_MAX, 10) : 5,
  resyncDelaySec: process.env.PEPR_RESYNC_DELAY_SECONDS ? parseInt(process.env.PEPR_RESYNC_DELAY_SECONDS, 10) : 5,
  lastSeenLimitSeconds: process.env.PEPR_LAST_SEEN_LIMIT_SECONDS ? parseInt(process.env.PEPR_LAST_SEEN_LIMIT_SECONDS, 10) : 300,
  relistIntervalSec: process.env.PEPR_RELIST_INTERVAL_SECONDS ? parseInt(process.env.PEPR_RELIST_INTERVAL_SECONDS, 10) : 600,
};

// Map the event to the watch phase
const eventToPhaseMap = {
  [Event.CREATE]: [WatchPhase.Added],
  [Event.UPDATE]: [WatchPhase.Modified],
  [Event.CREATE_OR_UPDATE]: [WatchPhase.Added, WatchPhase.Modified],
  [Event.DELETE]: [WatchPhase.Deleted],
  [Event.ANY]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
};

/**
 * Entrypoint for setting up watches for all capabilities
 */
export function setupWatch(capabilities: Capability[], ignoredNamespaces?: string[]): void {
  console.log(`🔍 setupWatch called with ${capabilities.length} capabilities`);
  Log.info(`setupWatch called with ${capabilities.length} capabilities`);
  
  let totalBindings = 0;
  let watchBindings = 0;
  
  for (const capability of capabilities) {
    totalBindings += capability.bindings.length;
    const watchBindingsForCap = capability.bindings.filter(b => b.isWatch);
    watchBindings += watchBindingsForCap.length;
    
    console.log(`📦 Capability '${capability.name}': ${capability.bindings.length} total bindings, ${watchBindingsForCap.length} watch bindings`);
    Log.info(`Capability '${capability.name}': ${capability.bindings.length} total bindings, ${watchBindingsForCap.length} watch bindings`);
    
    for (const binding of watchBindingsForCap) {
      console.log(`⚙️ Setting up watch binding for event: ${binding.event}`);
      Log.info(`Setting up watch binding for event: ${binding.event}`);
      void runBinding(binding, capability.namespaces, ignoredNamespaces);
    }
  }
  
  console.log(`📊 Total: ${totalBindings} bindings, ${watchBindings} watch bindings`);
  Log.info(`Total: ${totalBindings} bindings, ${watchBindings} watch bindings`);
  
  if (watchBindings === 0) {
    console.warn("⚠️ No watch bindings found! Check that your capabilities have .Watch() actions.");
    Log.warn("No watch bindings found! Check that your capabilities have .Watch() actions.");
  }
}

/**
 * Compute a unique streamKey for this watch request
 */
function computeStreamKey(gvk: any, resourceName: string, req: WatchRequest): string {
  return [
    gvk.group || "",
    gvk.version || "v1",
    resourceName,
    req.namespace || "*",
    `ls=${req.labelSelector || ""}`,
    `fs=${req.fieldSelector || ""}`,
    `rs=${req.resyncPeriodSeconds || 0}`,
  ].join("|");
}

/**
 * Backoff with jitter (caps at 30s)
 */
function nextBackoffMs(streamKey: string): number {
  const attempt = reconnectAttempts.get(streamKey) ?? 0;
  const base = Math.min(30_000, 1_000 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 500);
  reconnectAttempts.set(streamKey, attempt + 1);
  return base + jitter;
}

function resetBackoff(streamKey: string): void {
  reconnectAttempts.delete(streamKey);
}

/**
 * Schedule reconnect once per streamKey (guarded)
 */
function scheduleReconnect(
  streamKey: string,
  binding: Binding,
  capabilityNamespaces: string[],
  ignoredNamespaces: string[] | undefined,
  reason: string,
  err?: any,
): void {
  if (reconnecting.has(streamKey)) return;
  reconnecting.add(streamKey);

  // Clear any existing timer
  const existingTimer = reconnectTimers.get(streamKey);
  if (existingTimer) {
    try {
      clearTimeout(existingTimer);
    } catch {
      // ignore
    }
    reconnectTimers.delete(streamKey);
  }

  const delay = nextBackoffMs(streamKey);

  // Helpful logging without importing grpc status enums
  const code = err?.code;
  const msg = err?.message || String(err || "");
  Log.warn(`Scheduling reconnect for ${streamKey} in ${delay}ms (${reason}${code !== undefined ? `, code=${code}` : ""})`);
  if (msg) Log.debug(msg);

  const timer = setTimeout(() => {
    reconnecting.delete(streamKey);
    reconnectTimers.delete(streamKey);
    void runBinding(binding, capabilityNamespaces, ignoredNamespaces);
  }, delay);

  reconnectTimers.set(streamKey, timer);
}

/**
 * Setup a watch for a binding
 */
export async function runBinding(
  binding: Binding,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): Promise<void> {
  try {
    Log.info(`runBinding called for binding with event: ${binding.event}`);
    
    const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.ANY];
    Log.debug({ watchCfg }, "Effective WatchConfig");

    const gvk = binding.kind || modelToGroupVersionKind(binding.model.name);
    Log.info(`Setting up gRPC watch for GVK: ${JSON.stringify(gvk)}`);

    // Keeping your current resource selection; note pluralization can be imperfect.
    const resourceName = gvk.plural || (gvk.kind.toLowerCase() + "s");
    Log.info(`Using resource name: ${resourceName}`);

    // Base watch request
    const baseRequest: WatchRequest = {
      group: gvk.group || "",
      version: gvk.version || "v1",
      resource: resourceName,
      namespace: binding.filters.namespaces.length > 0 ? binding.filters.namespaces[0] : "",
      fieldSelector: binding.filters.name.length > 0 ? `metadata.name=${binding.filters.name}` : "",
      labelSelector: Object.entries(binding.filters.labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(","),
      resyncPeriodSeconds: watchCfg.relistIntervalSec || 600,
      sendInitialList: true,
      startResourceVersion: "",
    };
    
    Log.info(`Watch request: ${JSON.stringify(baseRequest, null, 2)}`);

  // streamKey derived from baseRequest (no resume RV included in key)
  const streamKey = computeStreamKey(gvk, resourceName, baseRequest);

  // Resume if we have RV
  const resumeRV = lastSeenRV.get(streamKey) || "";
  const watchRequest: WatchRequest = {
    ...baseRequest,
    startResourceVersion: resumeRV,
    sendInitialList: resumeRV === "", // snapshot only when we don't have RV yet
  };

  Log.info(`Setting up gRPC watch stream for ${gvk.group}/${gvk.version}/${resourceName} (key=${streamKey})`);

  // De-dupe: cancel existing stream for this key
  const existing = activeStreams.get(streamKey);
  if (existing) {
    try {
      existing.cancel();
      Log.debug(`Cancelled existing stream before starting new one: ${streamKey}`);
    } catch (e) {
      Log.error(e, `Error cancelling existing stream: ${streamKey}`);
    }
    activeStreams.delete(streamKey);
  }

    // If we're starting a stream now, clear pending reconnect timer/guard
    const pendingTimer = reconnectTimers.get(streamKey);
    if (pendingTimer) {
      try { clearTimeout(pendingTimer); } catch { /* ignore */ }
      reconnectTimers.delete(streamKey);
    }
    reconnecting.delete(streamKey);

    Log.info(`Creating gRPC client and establishing stream for ${streamKey}`);
    const client = getGrpcClient();
    const stream = client.watch(watchRequest);
    activeStreams.set(streamKey, stream);

    Log.info(`gRPC watch stream established for ${streamKey} (resumeRV=${resumeRV || "none"})`);

    const watchCallback = async (kubernetesObject: KubernetesObject, phase: WatchPhase): Promise<void> => {
      if (!phaseMatch.includes(phase)) return;

      try {
        const filterMatch = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces, ignoredNamespaces);
        if (filterMatch !== "") {
          Log.debug(filterMatch);
          return;
        }

        if (binding.isFinalize) {
          await handleFinalizerRemoval(kubernetesObject);
        } else {
          await binding.watchCallback?.(kubernetesObject, phase);
        }
      } catch (e) {
        Log.error(e, "Error executing watch callback");
      }
    };

    const handleFinalizerRemoval = async (kubernetesObject: KubernetesObject): Promise<void> => {
      if (!kubernetesObject.metadata?.deletionTimestamp) return;

      let shouldRemoveFinalizer: boolean | void | undefined = true;
      try {
        shouldRemoveFinalizer = await binding.finalizeCallback?.(kubernetesObject);
      } finally {
        const peprFinal = "pepr.dev/finalizer";
        const meta = kubernetesObject.metadata!;
        const resource = `${meta.namespace || "ClusterScoped"}/${meta.name}`;

        if (shouldRemoveFinalizer === false) {
          Log.debug({ obj: kubernetesObject }, `Skipping removal of finalizer '${peprFinal}' from '${resource}'`);
        } else {
          await removeFinalizer(binding, kubernetesObject);
        }
      }
    };

    stream.on("data", async (response: WatchResponse) => {
      Log.info(`gRPC watch data received for ${streamKey} - eventType: ${EventType[response.eventType]}`);
      try {
        // Always keep lastSeenRV updated (including SNAPSHOT_END)
        if (response.resourceVersion) {
          lastSeenRV.set(streamKey, response.resourceVersion);
        }

        if (response.eventType === EventType.SNAPSHOT_END) {
          Log.info(`Snapshot complete for ${streamKey} @rv=${response.resourceVersion || "unknown"}`);
          return;
        }

        const phase = eventTypeToWatchPhase(response.eventType);
        if (phase === null) {
          Log.debug(`Ignoring event type: ${EventType[response.eventType]}`);
          return;
        }

        // Decode details (Uint8Array) as UTF-8 JSON
        let kubernetesObject: KubernetesObject;
        try {
          const jsonStr = Buffer.from(response.details).toString("utf8");
          kubernetesObject = JSON.parse(jsonStr) as KubernetesObject;
        } catch (parseError) {
          Log.error(parseError, "Failed to parse Kubernetes object from gRPC response");
          return;
        }

        Log.info(`Processing ${phase} event for ${kubernetesObject.kind}/${kubernetesObject.metadata?.name}`);

        // Stream is healthy → reset backoff
        resetBackoff(streamKey);

        if (binding.isQueue) {
          const queue = getOrCreateQueue(kubernetesObject);
          await queue.enqueue(kubernetesObject, phase, watchCallback);
        } else {
          await watchCallback(kubernetesObject, phase);
        }
      } catch (error) {
        Log.error(error, "Error processing gRPC watch event");
      }
    });

    stream.on("error", (error: any) => {
      Log.error(error, `gRPC watch stream error for ${streamKey} - ${error.message || error}`);
      activeStreams.delete(streamKey);
      scheduleReconnect(streamKey, binding, capabilityNamespaces, ignoredNamespaces, "error", error);
    });

    stream.on("end", () => {
      Log.warn(`gRPC watch stream ended for ${streamKey}`);
      activeStreams.delete(streamKey);
      scheduleReconnect(streamKey, binding, capabilityNamespaces, ignoredNamespaces, "end");
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Log.error(error, `Failed to setup gRPC watch binding: ${errorMsg}`);
    throw error;
  }
}

export type WatchEventArgs<K extends WatchEvent, T extends GenericClass> = {
  [WatchEvent.LIST]: KubernetesListObject<InstanceType<T>>;
  [WatchEvent.RECONNECT]: number;
  [WatchEvent.CACHE_MISS]: string;
  [WatchEvent.INIT_CACHE_MISS]: string;
  [WatchEvent.GIVE_UP]: Error;
  [WatchEvent.ABORT]: Error;
  [WatchEvent.OLD_RESOURCE_VERSION]: string;
  [WatchEvent.NETWORK_ERROR]: Error;
  [WatchEvent.LIST_ERROR]: Error;
  [WatchEvent.DATA_ERROR]: Error;
  [WatchEvent.CONNECT]: string;
  [WatchEvent.RECONNECT_PENDING]: undefined;
  [WatchEvent.DATA]: undefined;
  [WatchEvent.INC_RESYNC_FAILURE_COUNT]: number;
}[K];
