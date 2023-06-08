// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ListMeta, V1ObjectMeta } from "@kubernetes/client-node";

export enum Operation {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CONNECT = "CONNECT",
}

export interface KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
}
export interface KubernetesListObject<T extends KubernetesObject> {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ListMeta;
  items: T[];
}

/**
 * GenericKind is a generic Kubernetes object that can be used to represent any Kubernetes object
 * that is not explicitly supported by Pepr. This can be used on its own or as a base class for
 * other types. See the examples in `HelloPepr.ts` for more information.
 */
export class GenericKind {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * GroupVersionKind unambiguously identifies a kind. It doesn't anonymously include GroupVersion
 * to avoid automatic coercion. It doesn't use a GroupVersion to avoid custom marshalling
 **/
export interface GroupVersionKind {
  /** The K8s resource kind, e..g "Pod". */
  readonly kind: string;
  readonly group: string;
  readonly version?: string;
  /** Optional, override the plural name for use in Webhook rules generation */
  readonly plural?: string;
}

/**
 * GroupVersionResource unambiguously identifies a resource. It doesn't anonymously include GroupVersion
 * to avoid automatic coercion. It doesn't use a GroupVersion to avoid custom marshalling
 */
export interface GroupVersionResource {
  readonly group: string;
  readonly version: string;
  readonly resource: string;
}

/**
 * A Kubernetes admission request to be processed by a capability.
 */
export interface Request<T = KubernetesObject> {
  /** UID is an identifier for the individual request/response. */
  readonly uid: string;

  /** Kind is the fully-qualified type of object being submitted (for example, v1.Pod or autoscaling.v1.Scale) */
  readonly kind: GroupVersionKind;

  /** Resource is the fully-qualified resource being requested (for example, v1.pods) */
  readonly resource: GroupVersionResource;

  /** SubResource is the sub-resource being requested, if any (for example, "status" or "scale") */
  readonly subResource?: string;

  /** RequestKind is the fully-qualified type of the original API request (for example, v1.Pod or autoscaling.v1.Scale). */
  readonly requestKind?: GroupVersionKind;

  /** RequestResource is the fully-qualified resource of the original API request (for example, v1.pods). */
  readonly requestResource?: GroupVersionResource;

  /** RequestSubResource is the sub-resource of the original API request, if any (for example, "status" or "scale"). */
  readonly requestSubResource?: string;

  /**
   * Name is the name of the object as presented in the request. On a CREATE operation, the client may omit name and
   * rely on the server to generate the name. If that is the case, this method will return the empty string.
   */
  readonly name: string;

  /** Namespace is the namespace associated with the request (if any). */
  readonly namespace?: string;

  /**
   * Operation is the operation being performed. This may be different than the operation
   * requested. e.g. a patch can result in either a CREATE or UPDATE Operation.
   */
  readonly operation: Operation;

  /** UserInfo is information about the requesting user */
  readonly userInfo: {
    /** The name that uniquely identifies this user among all active users. */
    username?: string;

    /**
     * A unique value that identifies this user across time. If this user is deleted
     * and another user by the same name is added, they will have different UIDs.
     */
    uid?: string;

    /** The names of groups this user is a part of. */
    groups?: string[];

    /** Any additional information provided by the authenticator. */
    extra?: {
      [key: string]: string[];
    };
  };

  /** Object is the object from the incoming request prior to default values being applied */
  readonly object: T;

  /** OldObject is the existing object. Only populated for UPDATE requests. */
  readonly oldObject?: T;

  /** DryRun indicates that modifications will definitely not be persisted for this request. Defaults to false. */
  readonly dryRun?: boolean;

  /**
   * Options contains the options for the operation being performed.
   * e.g. `meta.k8s.io/v1.DeleteOptions` or `meta.k8s.io/v1.CreateOptions`. This may be
   * different than the options the caller provided. e.g. for a patch request the performed
   * Operation might be a CREATE, in which case the Options will a
   * `meta.k8s.io/v1.CreateOptions` even though the caller provided `meta.k8s.io/v1.PatchOptions`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly options?: any;
}

export interface Response {
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

  /** AuditAnnotations is an unstructured key value map set by remote admission controller (e.g. error=image-blacklisted). */
  auditAnnotations?: {
    [key: string]: string;
  };

  /** warnings is a list of warning messages to return to the requesting API client. */
  warnings?: string[];
}

export type WebhookIgnore = {
  /**
   * List of Kubernetes namespaces to always ignore.
   * Any resources in these namespaces will be ignored by Pepr.
   *
   * Note: `kube-system` and `pepr-system` are always ignored.
   */
  namespaces?: string[];
  /**
   * List of Kubernetes labels to always ignore.
   * Any resources with these labels will be ignored by Pepr.
   *
   * The example below will ignore any resources with the label `my-label=ulta-secret`:
   * ```
   * alwaysIgnore:
   *   labels: [{ "my-label": "ultra-secret" }]
   * ```
   */
  labels?: Record<string, string>[];
};
