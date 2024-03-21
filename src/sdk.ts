// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprValidateRequest } from "./lib/validate-request";
import { PeprMutateRequest } from "./lib/mutate-request";
import { a } from "./lib";

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

export function createEvent(): PeprValidateRequest<a.Pod> | PeprMutateRequest<a.Pod> {
  throw new Error("Not implemented");
}

export function getOwnerRef(request: PeprValidateRequest<a.Pod> | PeprMutateRequest<a.Pod>) {
  return request.Raw.metadata?.ownerReferences || [];
}