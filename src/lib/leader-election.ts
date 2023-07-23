// // SPDX-License-Identifier: Apache-2.0
// // SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// import { KubeConfig, CoreV1Api, makeInformer, V1Secret } from "@kubernetes/client-node";
// import { base64Encode } from "./utils";
// import { randomUUID } from "crypto";

// type SyncState = {
//   leader: string | null;
//   leaseTimestamp: number | null;
//   watcherLastRevision: Record<string, string>;
// };

// const kc = new KubeConfig();
// kc.loadFromDefault();

// // Create a CoreV1Api client to interact with Kubernetes API server
// const coreV1Client = kc.makeApiClient(CoreV1Api);

// // Define constants for the namespace and the name of the Secret
// const namespace = "pepr-system";
// const secretName = "sync-state";

// // Use the pod name as the identity
// const identity = process.env.HOSTNAME || randomUUID();

// let secretTimer: NodeJS.Timeout;
// let secretRenewalInterval: NodeJS.Timer;
// let isLeader = false;

// // Initialize the state which will hold the current leader, lease timestamp and watcher states
// let state: SyncState = {
//   leader: null,
//   leaseTimestamp: null,
//   watcherLastRevision: {},
// };

// /**
//  * Load the state from the Secret
//  */
// async function loadState() {
//   try {
//     // Read the Secret from Kubernetes
//     const secret = await coreV1Client.readNamespacedSecret(secretName, namespace);

//     // Parse the state from the Secret data
//     state = JSON.parse(Buffer.from(secret.body.data.state, "base64").toString());
//     console.log("Loaded state:", state);
//   } catch (e) {
//     console.error("Failed to load state:", e);
//   }
// }

// /**
//  * Save the state to the Secret
//  */
// async function saveState() {
//   try {
//     // Save the state to the Secret in Kubernetes
//     await coreV1Client.patchNamespacedSecret(secretName, namespace, {
//       data: {
//         state: base64Encode(JSON.stringify(state)),
//       },
//     });

//     console.log("Saved state:", state);
//   } catch (e) {
//     console.error("Failed to save state:", e);
//   }
// }

// /**
//  * Start the secretTimer with a jitter
//  * @param {number} duration - The duration to wait before trying to acquire the lease
//  */
// function startSecretTimer(duration: number) {
//   // Clear any existing timer
//   if (secretTimer) {
//     clearTimeout(secretTimer);
//   }

//   // Start a new timer with the specified duration plus a random jitter
//   const jitter = Math.random() * 5000;
//   secretTimer = setTimeout(tryAcquireLease, duration + jitter);
// }

// /**
//  * Start the lease renewal process
//  * @param {number} duration - The duration to wait before trying to renew the lease
//  */
// function startSecretRenewal(duration: number) {
//   // Clear any existing interval
//   if (secretRenewalInterval) {
//     clearInterval(secretRenewalInterval);
//   }

//   // Start a new interval to renew the lease every half of the lease duration
//   secretRenewalInterval = setInterval(renewLease, duration / 2);
// }

// /**
//  * Renew the lease in the Secret
//  */
// async function renewLease() {
//   console.log("Renewing lease...");

//   // Update the leader and lease timestamp in the state
//   state.leader = identity;
//   state.leaseTimestamp = Date.now();

//   // Save the state to the Secret
//   await saveState();

//   console.log("Lease renewed");
// }

// /**
//  * Try to acquire the lease
//  */
// async function tryAcquireLease() {
//   console.log("Lease expired, trying to acquire leadership...");

//   // Load the state from the Secret
//   await loadState();

//   // Check if the lease has expired
//   const now = Date.now();
//   if (state.leader !== identity && (state.leaseTimestamp === null || now - state.leaseTimestamp > 15000)) {
//     // If the lease has expired, try to renew it
//     await renewLease();
//   }

//   // Check if we have successfully acquired the lease
//   if (state.leader === identity) {
//     console.log("Successfully acquired lease");
//     isLeader = true;

//     // Start the lease renewal process
//     startSecretRenewal(15000);
//   }
// }

// /**
//  * Process an event from the informer
//  * @param {V1Secret} secret - The secret to process
//  */
// async function processEvent(secret: V1Secret) {
//   // Create a unique key for this event
//   const key = `${secret.kind}/${secret.metadata?.namespace}/${secret.metadata?.name}`;
//   console.log("Processing event:", key, secret.metadata?.resourceVersion);

//   // Update the watcher state in the state
//   state.watcherLastRevision[key] = secret.metadata.resourceVersion;

//   // If this pod is the leader, save the state
//   if (isLeader) {
//     await saveState();
//   }
// }

// async function main() {
//   // Load the state from the Secret
//   await loadState();

//   // Define the list function for the informer
//   const listFn = () => coreV1Client.listNamespacedSecret(namespace);

//   // Create the informer
//   const informer = makeInformer(kc, "/api/v1/namespaces/" + namespace + "/secrets", listFn);

//   // Register event handlers for the informer
//   informer.on("add", processEvent);
//   informer.on("update", processEvent);
//   informer.on("delete", processEvent);

//   // Register an error handler for the informer
//   informer.on("error", err => {
//     console.error("Error with informer:", err);
//     setTimeout(() => {
//       informer.start();
//     }, 5000);
//   });

//   // Start the informer
//   informer.start();

//   // Try to acquire the lease
//   tryAcquireLease();
// }

// main();
