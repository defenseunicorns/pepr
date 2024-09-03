// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { K8s, kind, KubernetesObject, RegisterKind, GroupVersionKind, WatchCfg, WatchEvent } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Capability } from "./capability";
import { filterNoMatchReason } from "./helpers";
import Log from "./logger";
import { Queue } from "./queue";
import { Binding, Event } from "./types";
import { metricsCollector } from "./metrics";

// stores Queue instances
const queues: Record<string, Queue<KubernetesObject>> = {};

// default + dynamically-registered Kinds
let kinds = kind;

/**
 * Get the key for an entry in the queues
 *
 * @param obj The object to derive a key from
 * @returns The key to a Queue in the list of queues
 */
export function queueKey(obj: KubernetesObject) {
  const options = ["kind", "kindNs", "kindNsName", "global"];
  const d3fault = "kind";

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

export function getOrCreateQueue(obj: KubernetesObject) {
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
  lastSeenLimitSeconds: process.env.PEPR_LAST_SEEN_LIMIT_SECONDS
    ? parseInt(process.env.PEPR_LAST_SEEN_LIMIT_SECONDS, 10)
    : 300,
  relistIntervalSec: process.env.PEPR_RELIST_INTERVAL_SECONDS
    ? parseInt(process.env.PEPR_RELIST_INTERVAL_SECONDS, 10)
    : 600,
};

// Map the event to the watch phase
const eventToPhaseMap = {
  [Event.Create]: [WatchPhase.Added],
  [Event.Update]: [WatchPhase.Modified],
  [Event.CreateOrUpdate]: [WatchPhase.Added, WatchPhase.Modified],
  [Event.Delete]: [WatchPhase.Deleted],
  [Event.Any]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
};

/**
 * Entrypoint for setting up watches for all capabilities
 *
 * @param capabilities The capabilities to load watches for
 */
export function setupWatch(capabilities: Capability[]) {
  capabilities.map(capability =>
    capability.bindings
      .filter(binding => binding.isWatch)
      .forEach(bindingElement => runBinding(bindingElement, capability.namespaces)),
  );
}

/**
 * Setup a watch for a binding
 *
 * @param binding the binding to watch
 * @param capabilityNamespaces list of namespaces to filter on
 */
async function runBinding(binding: Binding, capabilityNamespaces: string[]) {
  // Get the phases to match, fallback to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.Any];

  // The watch callback is run when an object is received or dequeued
  Log.debug({ watchCfg }, "Effective WatchConfig");

  const watchCallback = async (obj: KubernetesObject, phase: WatchPhase) => {
    // First, filter the object based on the phase
    if (phaseMatch.includes(phase)) {
      try {

        // Then, check if the object matches the filter
        const filterMatch = filterNoMatchReason(binding, obj, capabilityNamespaces);
        if (filterMatch === "") {
          if (binding.isFinalize) {
            if (! obj.metadata?.deletionTimestamp) { return }
            try {
              await binding.finalizeCallback?.(obj);
            }
            finally {
              // Have to RegisterKind as done in:
              // /home/barrett/workspace/defuni/pepr-excellent-examples/_helpers/src/cluster.ts

            //   export declare class V1CertificateSigningRequest {
            //     /**
            //     * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
            //     */
            //     'apiVersion'?: string;
            //     /**
            //     * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
            //     */
            //     'kind'?: string;
            //     'metadata'?: V1ObjectMeta;
            //     'spec': V1CertificateSigningRequestSpec;
            //     'status'?: V1CertificateSigningRequestStatus;
            //     static readonly discriminator: string | undefined;
            //     static readonly attributeTypeMap: Array<{
            //         name: string;
            //         baseName: string;
            //         type: string;
            //         format: string;
            //     }>;
            //     static getAttributeTypeMap(): {
            //         name: string;
            //         baseName: string;
            //         type: string;
            //         format: string;
            //     }[];
            //     constructor();
            // }

              // const kynd = class extends kind.GenericKind {}
              // const kynd = { name: obj.kind } as kind.GenericKind
              // const kynd = class extends kind.GenericKind { name: "asdf" }
              
              // RegisterKind(kynd, { group: grp, version: ver, kind: knd })

              // EventsV1Event: {
              //   kind: "Event",
              //   version: "v1",
              //   group: "events.k8s.io",
              // },

              class kynd implements GroupVersionKind {
                kind: string;
                group: string;
                constructor() {
                  this.kind = "foo";
                  this.group = "bar";
                }
              }
              RegisterKind(foo, new foo());

              await K8s(???, {
                namespace: obj.metadata.namespace,
                name: obj.metadata.name,
              }).Patch([{
                op: "remove",
                path: "/metadata/deletionTimestamp"
              }]);

            }

          } else {
            await binding.watchCallback?.(obj, phase);
          }

        } else {
          Log.debug(filterMatch);
        }
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
    }
  };

  // Setup the resource watch
  const watcher = K8s(binding.model, binding.filters).Watch(async (obj, phase) => {
    Log.debug(obj, `Watch event ${phase} received`);

    if (binding.isQueue) {
      const queue = getOrCreateQueue(obj);
      await queue.enqueue(obj, phase, watchCallback);
    } else {
      await watchCallback(obj, phase);
    }

  }, watchCfg);

  // If failure continues, log and exit
  watcher.events.on(WatchEvent.GIVE_UP, err => {
    Log.error(err, "Watch failed after 5 attempts, giving up");
    process.exit(1);
  });

  watcher.events.on(WatchEvent.CONNECT, url => logEvent(WatchEvent.CONNECT, url));

  watcher.events.on(WatchEvent.DATA_ERROR, err => logEvent(WatchEvent.DATA_ERROR, err.message));
  watcher.events.on(WatchEvent.RECONNECT, retryCount =>
    logEvent(WatchEvent.RECONNECT, `Reconnecting after ${retryCount} attempt${retryCount === 1 ? "" : "s"}`),
  );
  watcher.events.on(WatchEvent.RECONNECT_PENDING, () => logEvent(WatchEvent.RECONNECT_PENDING));
  watcher.events.on(WatchEvent.GIVE_UP, err => logEvent(WatchEvent.GIVE_UP, err.message));
  watcher.events.on(WatchEvent.ABORT, err => logEvent(WatchEvent.ABORT, err.message));
  watcher.events.on(WatchEvent.OLD_RESOURCE_VERSION, err => logEvent(WatchEvent.OLD_RESOURCE_VERSION, err));
  watcher.events.on(WatchEvent.NETWORK_ERROR, err => logEvent(WatchEvent.NETWORK_ERROR, err.message));
  watcher.events.on(WatchEvent.LIST_ERROR, err => logEvent(WatchEvent.LIST_ERROR, err.message));
  watcher.events.on(WatchEvent.LIST, list => logEvent(WatchEvent.LIST, JSON.stringify(list, undefined, 2)));
  watcher.events.on(WatchEvent.CACHE_MISS, windowName => {
    metricsCollector.incCacheMiss(windowName);
  });

  watcher.events.on(WatchEvent.INIT_CACHE_MISS, windowName => {
    metricsCollector.initCacheMissWindow(windowName);
  });

  watcher.events.on(WatchEvent.INC_RESYNC_FAILURE_COUNT, retryCount => {
    metricsCollector.incRetryCount(retryCount);
  });

  // Start the watch
  try {
    await watcher.start();
  } catch (err) {
    Log.error(err, "Error starting watch");
    process.exit(1);
  }
}

export function logEvent(event: WatchEvent, message: string = "", obj?: KubernetesObject) {
  const logMessage = `Watch event ${event} received${message ? `. ${message}.` : "."}`;
  if (obj) {
    Log.debug(obj, logMessage);
  } else {
    Log.debug(logMessage);
  }
}
