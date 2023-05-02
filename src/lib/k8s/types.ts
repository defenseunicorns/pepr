// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ListMeta, V1ObjectMeta } from "@kubernetes/client-node";

/**
 * Enumeration of possible operations.
 */
export enum Operation {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CONNECT = "CONNECT",
}

/**
 * Interface for a Kubernetes object.
 */
export interface KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
}

/**
 * Interface for a Kubernetes list object.
 */
export interface KubernetesListObject<T extends KubernetesObject> {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ListMeta;
  items: T[];
}

/**
 * GenericKind is a generic Kubernetes object that can be used to represent any Kubernetes object
 * that is not explicitly supported by Pepr. This can be used on its own or as a base class for
 * other types.
 */
export class GenericKind {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
  [key: string]: unknown;
}

/**
 * Interface for a GroupVersionKind.
 */
export interface GroupVersionKind {
  /** The K8s resource kind, e.g. "Pod". */
  readonly kind: string;
  readonly group: string;
  readonly version?: string;
}

/**
 * Interface for a GroupVersionResource.
 */
export interface GroupVersionResource {
  readonly group: string;
  readonly version: string;
  readonly resource: string;
}

/**
 * Interface for a Kubernetes admission request to be processed by a capability.
 */
export interface Request<T = KubernetesObject> {
  readonly uid: string; // UID is an identifier for the individual request/response.
  readonly kind: GroupVersionKind; // Kind is the fully-qualified type of object being submitted.
  readonly resource: GroupVersionResource; // Resource is the fully-qualified resource being requested.
  readonly subResource?: string; // SubResource is the sub-resource being requested, if any.
  readonly requestKind?: GroupVersionKind; // RequestKind is the fully-qualified type of the original API request.
  readonly requestResource?: GroupVersionResource; // RequestResource is the fully-qualified resource of the original API request.
  readonly requestSubResource?: string; // RequestSubResource is the sub-resource of the original API request, if any.
  readonly name: string; // Name is the name of the object as presented in the request.
  readonly namespace?: string; // Namespace is the namespace associated with the request (if any).
  readonly operation: Operation; // Operation is the operation being performed.
  readonly userInfo: { // UserInfo is information about the requesting user.
    readonly username?: string; // The name that uniquely identifies this user among all active users.
    readonly uid?: string; // A unique value that identifies this user across time.
    readonly groups?: string[]; // The names of groups this user is a part of.
    readonly extra?: { [key: string]: string[] }; // Any additional information provided by the authenticator.
  };
  readonly object: T; // Object is the object from the incoming request prior to default values being applied.
  readonly oldObject?: T; // OldObject is the existing object. Only populated for UPDATE requests.
  readonly dryRun?: boolean; // DryRun indicates that modifications will definitely not be persisted for this request.
  readonly options?: unknown; // Options contains the options for the operation being performed.
}

/**
 * Interface for a Kubernetes admission response.
 */
export interface Response {
  readonly uid: string; // UID is an identifier for the individual request/response.
  readonly allowed: boolean; // Allowed indicates whether or not the admission request was permitted.
  readonly result?: string; // Result contains extra details into why an admission request was denied.
  readonly patch?: unknown; // The patch body.
  readonly patchType?: "JSONPatch"; // The type of Patch.
  readonly auditAnnotations?: { [key: string]: string }; // AuditAnnotations is an unstructured key value map set by remote admission controller.
  readonly warnings?: string[]; // Warnings is a list of warning messages to return to the requesting API client.
}

/**
 * Interface for specifying resources to ignore.
 */
export type WebhookIgnore = {
  readonly namespaces?: string[]; // List of Kubernetes namespaces to always ignore.
  readonly labels?: Record<string, string>[]; // List of Kubernetes labels to always ignore.
};

export default {
  Operation,
  KubernetesObject,
  KubernetesListObject,
  GenericKind,
  GroupVersionKind,
  GroupVersionResource,
  Request,
  Response,
  WebhookIgnore,
};