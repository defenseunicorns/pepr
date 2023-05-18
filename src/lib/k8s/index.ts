// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Export kinds as a single object
import * as kind from "./upstream";
/** a is a collection of K8s types to be used within a CapabilityAction: `When(a.Configmap)` */
export { kind as a };

export { modelToGroupVersionKind, gvkMap, RegisterKind } from "./kinds";

export * from "./types";
