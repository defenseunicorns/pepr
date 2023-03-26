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
 * Bindings to filter if a request should be responded to or not.
 *
 * These are used to filter out requests that are not relevant to the capability.
 * The list can be found via `kubectl api-resources`.
 * */
export interface GroupVersionKind {
  /** The K8s resource kind, e..g "Pod". */
  readonly kind: string;
  readonly group: string;
  readonly version?: string;
}

/**
 * A Kubernetes admission request to be processed by a capability.
 */
export interface Request<T = KubernetesObject> {
  /** UID is an identifier for the individual request/response. */
  readonly uid: string;

  /** Kind is the fully-qualified type of object being submitted (for example, v1.Pod or autoscaling.v1.Scale) */
  readonly kind: string;

  /** Resource is the fully-qualified resource being requested (for example, v1.pods) */
  readonly resource: string;

  /** SubResource is the subresource being requested, if any (for example, "status" or "scale") */
  readonly subResource?: string;

  /** RequestKind is the fully-qualified type of the original API request (for example, v1.Pod or autoscaling.v1.Scale). */
  readonly requestKind?: string;

  /** RequestResource is the fully-qualified resource of the original API request (for example, v1.pods). */
  readonly requestResource?: string;

  /** RequestSubResource is the subresource of the original API request, if any (for example, "status" or "scale"). */
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
  object?: T;

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
  readonly options?: any;
}

export interface Response {
  /** UID is an identifier for the individual request/response. This must be copied over from the corresponding AdmissionRequest. */
  uid: string;

  /** Allowed indicates whether or not the admission request was permitted. */
  allowed: boolean;

  /** Result contains extra details into why an admission request was denied. This field IS NOT consulted in any way if "Allowed" is "true". */
  result?: any;

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
