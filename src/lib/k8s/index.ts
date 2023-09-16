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

// Track if this is a watch mode controller
export const isWatchMode = () => process.env.PEPR_WATCH_MODE === "true";

// Track if Pepr is running in build mode
export const isBuildMode = () => process.env.PEPR_MODE === "build";

export const isDevMode = () => process.env.PEPR_MODE === "dev";

export * from "./types";
