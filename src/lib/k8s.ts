// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericKind, RegisterKind } from "kubernetes-fluent-client";

/**
 * PeprStore for internal use by Pepr. This is used to store arbitrary data in the cluster.
 */
export class Store extends GenericKind {
  declare data: {
    [key: string]: string;
  };
}

export const peprStoreGVK = {
  kind: "PeprStore",
  version: "v1",
  group: "pepr.dev",
};

RegisterKind(Store, peprStoreGVK);

export interface MutateResponse {
  /** UID is an identifier for the individual request/response. This must be copied over from the corresponding AdmissionRequest. */
  uid: string;

  /** Allowed indicates whether or not the admission request was permitted. */
  allowed: boolean;

  /** Result contains extra details into why an admission request was denied. This field IS NOT consulted in any way if "Allowed" is "true". */
  result?: string;

  /** The patch body. Currently we only support "JSONPatch" which implements RFC 6902. */
  patch?: string;

  /** The type of Patch. Currently we only allow "JSONPatch". */
  patchType?: "JSONPatch";

  /**
   * AuditAnnotations is an unstructured key value map set by remote admission controller (e.g. error=image-blacklisted).
   *
   * See https://kubernetes.io/docs/reference/labels-annotations-taints/audit-annotations/ for more information
   */
  auditAnnotations?: {
    [key: string]: string;
  };

  /** warnings is a list of warning messages to return to the requesting API client. */
  warnings?: string[];
}

export interface ValidateResponse extends MutateResponse {
  /** Status contains extra details into why an admission request was denied. This field IS NOT consulted in any way if "Allowed" is "true". */
  status?: {
    /** A machine-readable description of why this operation is in the
         "Failure" status. If this value is empty there is no information available. */
    code: number;

    /** A human-readable description of the status of this operation. */
    message: string;
  };
}

export type WebhookIgnore = {
  /**
   * List of Kubernetes namespaces to always ignore.
   * Any resources in these namespaces will be ignored by Pepr.
   *
   * Note: `kube-system` and `pepr-system` are always ignored.
   */
  namespaces?: string[];
};
