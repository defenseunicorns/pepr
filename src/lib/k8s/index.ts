// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Export kinds as a single object
import * as kind from "./upstream";

/** a is a collection of K8s types to be used within an action: `When(a.Configmap)` */
export { kind as a };

/** given is a collection of K8s types to be used within a Kube call: `Kube(given.Secret).Apply({})`. `a` may also be used in it's place */
export { kind as given };

export { Kube } from "./fluent/kube";

export { modelToGroupVersionKind, gvkMap, RegisterKind } from "./kinds";

// If the hostname is pepr-static-test-watcher-0, then we are running in watch mode
export const isWatchMode = process.env.PEPR_WATCH_MODE === "true";

export * from "./types";
