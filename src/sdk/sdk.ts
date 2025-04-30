// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprValidateRequest } from "../lib/validate-request";
import { PeprMutateRequest } from "../lib/mutate-request";
import { V1OwnerReference, V1Container } from "@kubernetes/client-node";
import { GenericKind, K8s, kind } from "kubernetes-fluent-client";

/**
 * Returns all containers in a pod
 * @param request the request/pod to get the containers from
 * @param containerType the type of container to get
 * @returns the list of containers in the pod
 */
export function containers(
  request: PeprValidateRequest<kind.Pod> | PeprMutateRequest<kind.Pod>,
  containerType?: "containers" | "initContainers" | "ephemeralContainers",
): V1Container[] {
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
  options: {
    eventType: string;
    eventReason: string;
    reportingComponent: string;
    reportingInstance: string;
  },
): Promise<void> {
  const { eventType, eventReason, reportingComponent, reportingInstance } = options;

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
 * @param customResource the custom resource to get the owner reference for
 * @param blockOwnerDeletion if true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed.
 * @param controller if true, this reference points to the managing controller.
 * @returns the owner reference array for the custom resource
 */
export function getOwnerRefFrom(
  customResource: GenericKind,
  blockOwnerDeletion?: boolean,
  controller?: boolean,
): V1OwnerReference[] {
  const { apiVersion, kind, metadata } = customResource;
  const { name, uid } = metadata!;

  return [
    {
      apiVersion: apiVersion!,
      kind: kind!,
      uid: uid!,
      name: name!,
      ...(blockOwnerDeletion !== undefined && { blockOwnerDeletion }),
      ...(controller !== undefined && { controller }),
    },
  ];
}

/**
 * Sanitize a resource name to make it a valid Kubernetes resource name.
 *
 * @param name the name of the resource to sanitize
 * @returns the sanitized resource name
 */
export function sanitizeResourceName(name: string): string {
  return (
    name
      .toLowerCase()
      // Replace invalid characters (anything not a-z, 0-9, or '-') with '-'
      .replace(/[^a-z0-9-]+/g, "-")
      // Trim to 63 characters (DNS label max length)
      .slice(0, 63)
      // Remove leading non-alphanumeric characters
      .replace(/^[^a-z0-9]+/, "")
      // Remove trailing non-alphanumeric characters
      .replace(/[^a-z0-9]+$/, "")
  );
}
