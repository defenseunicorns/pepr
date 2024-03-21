// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprValidateRequest } from "./lib/validate-request";
import { PeprMutateRequest } from "./lib/mutate-request";
import { a } from "./lib";
import { V1OwnerReference } from "@kubernetes/client-node";
import { GenericKind } from "kubernetes-fluent-client";

// Returns all containers in the pod
export function containers(
  request: PeprValidateRequest<a.Pod> | PeprMutateRequest<a.Pod>,
  containerType?: "containers" | "initContainers" | "ephemeralContainers",
) {
  const containers = request.Raw.spec?.containers || [];
  const initContainers = request.Raw.spec?.initContainers || [];
  const ephemeralContainers = request.Raw.spec?.ephemeralContainers || [];

  if (containerType === "containers") {
    return containers;
  }
  if (containerType === "initContainers") {
    return initContainers;
  }
  if (containerType === "ephemeralContainers") {
    return ephemeralContainers;
  }
  return [...containers, ...initContainers, ...ephemeralContainers];
}

export function writeEvent(): PeprValidateRequest<a.Pod> | PeprMutateRequest<a.Pod> {
  throw new Error("Not implemented");
}

/**
 * Get the owner reference for a custom resource
 * @param cr the custom resource to get the owner reference for
 * @returns the owner reference for the custom resource
 */
export function getOwnerRef(cr: GenericKind): V1OwnerReference[] {
  const { name, uid } = cr.metadata!;

  return [
    {
      apiVersion: cr.apiVersion!,
      kind: cr.kind!,
      uid: uid!,
      name: name!,
    },
  ];
}

/**
 * Sanitize a resource name to make it a valid Kubernetes resource name.
 *
 * @param name the name of the resource to sanitize
 * @returns the sanitized resource name
 */
export function sanitizeResourceName(name: string) {
  return (
    name
      // The name must be lowercase
      .toLowerCase()
      // Replace sequences of non-alphanumeric characters with a single '-'
      .replace(/[^a-z0-9]+/g, "-")
      // Truncate the name to 250 characters
      .slice(0, 250)
      // Remove leading and trailing non-letter characters
      .replace(/^[^a-z]+|[^a-z]+$/g, "")
  );
}