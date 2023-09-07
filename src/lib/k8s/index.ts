// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Export kinds as a single object
import * as kind from "./upstream";
/** a is a collection of K8s types to be used within a action: `When(a.Configmap)` */
export { kind as a };

export { Kube } from "./fluent";

export { modelToGroupVersionKind, gvkMap, RegisterKind } from "./kinds";

// If the hostname is pepr-static-test-watcher-0, then we are running in watch mode
export const isWatchMode = process.env.PEPR_WATCH_MODE === "true";

export * from "./types";
