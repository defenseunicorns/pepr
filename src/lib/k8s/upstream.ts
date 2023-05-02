// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * This module exports a collection of Kubernetes types to be used within a CapabilityAction.
 * For example: `When(a.Configmap)`
 */

// Import only the necessary Kubernetes types to reduce the size of the bundle
export {
  V1ConfigMap as ConfigMap,
  V1Deployment as Deployment,
  V1Ingress as Ingress,
  V1Job as Job,
  V1Namespace as Namespace,
  V1Pod as Pod,
  V1Secret as Secret,
  V1Service as Service,
  V1ServiceAccount as ServiceAccount,
  V1StatefulSet as StatefulSet,
} from "@kubernetes/client-node/dist";

// Export the GenericKind type from a separate file for clarity
export { GenericKind } from "./types";