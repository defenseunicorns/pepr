// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Import all K8s types from upstream module and export them as a single object
import * as kind from "./upstream";
/** 
 * Export a collection of K8s types to be used within a CapabilityAction: `When(a.Configmap)`
 * This is an alias for the imported 'kind' object.
 */
export { kind as a };

// Export utility functions related to K8s types
export { modelToGroupVersionKind, gvkMap, RegisterKind } from "./kinds";

// Export all types from the 'types' module
export * from "./types";