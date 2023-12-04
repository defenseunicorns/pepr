// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprValidateRequest } from "./validate-request";
import { a } from "../lib";

// Returns all containers in the pod
export function containers(request: PeprValidateRequest<a.Pod>, containerTypes?: "containers" | "initContainers" | "ephemeralContainers") {
  const containers = request.Raw.spec?.containers || [];
  const initContainers = request.Raw.spec?.initContainers || [];
  const ephemeralContainers = request.Raw.spec?.ephemeralContainers || [];

  if (containerTypes === "containers") {
    return containers;
  }
  if (containerTypes === "initContainers") {
    return initContainers;
  }
  if (containerTypes === "ephemeralContainers") {
    return ephemeralContainers;
  }
  return [...containers, ...initContainers, ...ephemeralContainers]
}
