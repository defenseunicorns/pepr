// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprValidateRequest } from "../lib/validate-request";
import { PeprMutateRequest } from "../lib/mutate-request";
import { a } from "../lib";
import { V1OwnerReference } from "@kubernetes/client-node";
import { GenericKind } from "kubernetes-fluent-client";
import { K8s, kind } from "kubernetes-fluent-client";
import Log from "../lib/logger";

/**
 * Returns all containers in a pod
 * @param request the request/pod to get the containers from
 * @param containerType the type of container to get
 * @returns the list of containers in the pod
 */
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

/**
 * Write a K8s event for a CRD
 *
 * @param cr The custom resource to write the event for
 * @param event The event to write, should contain a human-readable message for the event
 * @param eventType The type of event to write, for example "Warning"
 * @param eventReason The reason for the event, for example "ReconciliationFailed"
 * @param reportingComponent The component that is reporting the event, for example "uds.dev/operator"
 * @param reportingInstance The instance of the component that is reporting the event, for example process.env.HOSTNAME
 */
export async function writeEvent(
  cr: GenericKind,
  event: Partial<kind.CoreEvent>,
  eventType: string,
  eventReason: string,
  reportingComponent: string,
  reportingInstance: string,
) {
  Log.debug(cr.metadata, `Writing event: ${event.message}`);

  await K8s(kind.CoreEvent).Create({
    type: eventType,
    reason: eventReason,
    ...event,
    // Fixed values
    metadata: {
      namespace: cr.metadata!.namespace,
      generateName: cr.metadata!.name,
    },
    involvedObject: {
      apiVersion: cr.apiVersion,
      kind: cr.kind,
      name: cr.metadata!.name,
      namespace: cr.metadata!.namespace,
      uid: cr.metadata!.uid,
    },
    firstTimestamp: new Date(),
    reportingComponent: reportingComponent,
    reportingInstance: reportingInstance,
  });
}

/**
 * Get the owner reference for a custom resource
 * @param cr the custom resource to get the owner reference for
 * @returns the owner reference for the custom resource
 */
export function getOwnerRefFrom(cr: GenericKind): V1OwnerReference[] {
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
