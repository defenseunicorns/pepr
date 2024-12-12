// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass, GroupVersionKind, KubernetesObject } from "kubernetes-fluent-client";
import { Event, Operation } from "./enums";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Logger } from "pino";
import { PeprMutateRequest } from "./mutate-request";
import { PeprValidateRequest } from "./validate-request";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";

/**
 * Specifically for deploying images with a private registry
 */
export interface ImagePullSecret {
  auths: {
    [server: string]: {
      username: string;
      password: string;
      email: string;
      auth: string;
    };
  };
}

/**
 * Specifically for parsing logs in monitor mode
 */
export interface ResponseItem {
  uid?: string;
  allowed: boolean;
  status: {
    message: string;
  };
}

export interface CapabilityCfg {
  /**
   * The name of the capability. This should be unique.
   */
  name: string;
  /**
   * A description of the capability and what it does.
   */
  description: string;
  /**
   * List of namespaces that this capability applies to, if empty, applies to all namespaces (cluster-wide).
   * This does not supersede the `alwaysIgnore` global configuration.
   */
  namespaces?: string[];
}

export interface CapabilityExport extends CapabilityCfg {
  bindings: Binding[];
  hasSchedule: boolean;
  rbac?: PolicyRule[];
}

export type WhenSelector<T extends GenericClass> = {
  /** Register an action to be executed when a Kubernetes resource is created or updated. */
  IsCreatedOrUpdated: () => BindingAll<T>;
  /** Register an action to be executed when a Kubernetes resource is created. */
  IsCreated: () => BindingAll<T>;
  /** Register ann action to be executed when a Kubernetes resource is updated. */
  IsUpdated: () => BindingAll<T>;
  /** Register an action to be executed when a Kubernetes resource is deleted. */
  IsDeleted: () => BindingAll<T>;
};
export interface RegExpFilter {
  obj: RegExp;
  source: string;
}

export type Filters = {
  annotations: Record<string, string>;
  deletionTimestamp: boolean;
  labels: Record<string, string>;
  name: string;
  namespaces: string[];
  regexName: string;
  regexNamespaces: string[];
};

export type Binding = {
  event: Event;
  isMutate?: boolean;
  isValidate?: boolean;
  isWatch?: boolean;
  isQueue?: boolean;
  isFinalize?: boolean;
  readonly model: GenericClass;
  readonly kind: GroupVersionKind;
  readonly filters: Filters;
  alias?: string;
  readonly mutateCallback?: MutateAction<GenericClass, InstanceType<GenericClass>>;
  readonly validateCallback?: ValidateAction<GenericClass, InstanceType<GenericClass>>;
  readonly watchCallback?: WatchLogAction<GenericClass, InstanceType<GenericClass>>;
  readonly finalizeCallback?: FinalizeAction<GenericClass, InstanceType<GenericClass>>;
};

export type BindingFilter<T extends GenericClass> = CommonActionChain<T> & {
  /**
   * Only apply the action if the resource has the specified label. If no value is specified, the label must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * When(a.Deployment)
   *   .IsCreated()
   *   .WithLabel("foo", "bar")
   *   .WithLabel("baz", "qux")
   *   .Mutate(...)
   * ```
   *
   * Will only apply the action if the resource has both the `foo=bar` and `baz=qux` labels.
   *
   * @param key
   * @param value
   */
  WithLabel: (key: string, value?: string) => BindingFilter<T>;
  /**
   * Only apply the action if the resource has the specified annotation. If no value is specified, the annotation must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * When(a.Deployment)
   *   .IsCreated()
   *   .WithAnnotation("foo", "bar")
   *   .WithAnnotation("baz", "qux")
   *   .Mutate(...)
   * ```
   *
   * Will only apply the action if the resource has both the `foo=bar` and `baz=qux` annotations.
   *
   * @param key
   * @param value
   */
  WithAnnotation: (key: string, value?: string) => BindingFilter<T>;
  /** Only apply the action if the resource has a deletionTimestamp. */
  WithDeletionTimestamp: () => BindingFilter<T>;
};

export type BindingWithName<T extends GenericClass> = BindingFilter<T> & {
  /** Only apply the action if the resource name matches the specified name. */
  WithName: (name: string) => BindingFilter<T>;
  /** Only apply the action if the resource name matches the specified regex name. */
  WithNameRegex: (name: RegExp) => BindingFilter<T>;
};

export type BindingAll<T extends GenericClass> = BindingWithName<T> & {
  /** Only apply the action if the resource is in one of the specified namespaces.*/
  InNamespace: (...namespaces: string[]) => BindingWithName<T>;
  /** Only apply the action if the resource is in one of the specified regex namespaces.*/
  InNamespaceRegex: (...namespaces: RegExp[]) => BindingWithName<T>;
};

export type CommonActionChain<T extends GenericClass> = MutateActionChain<T> & {
  /**
   * Create a new MUTATE action with the specified callback function and previously specified
   * filters.
   *
   * @since 0.13.0
   *
   * @param action The action to be executed when the Kubernetes resource is processed by the AdmissionController.
   */
  Mutate: (action: MutateAction<T, InstanceType<T>>) => MutateActionChain<T>;
  Alias: (alias: string) => BindingFilter<T>;
};

export type ValidateActionChain<T extends GenericClass> = {
  /**
   * Establish a watcher for the specified resource. The callback function will be executed after the admission controller has
   * processed the resource and the request has been persisted to the cluster.
   *
   * **Beta Function**: This method is still in early testing and edge cases may still exist.
   *
   * @since 0.14.0
   *
   * @param action
   * @returns
   */

  Watch: (action: WatchLogAction<T, InstanceType<T>>) => FinalizeActionChain<T>;

  /**
   * Establish a reconcile for the specified resource. The callback function will be executed after the admission controller has
   * processed the resource and the request has been persisted to the cluster.
   *
   * **Beta Function**: This method is still in early testing and edge cases may still exist.
   *
   * @since 0.14.0
   *
   * @param action
   * @returns
   */

  Reconcile: (action: WatchLogAction<T, InstanceType<T>>) => FinalizeActionChain<T>;
};

export type MutateActionChain<T extends GenericClass> = ValidateActionChain<T> & {
  /**
   * Create a new VALIDATE action with the specified callback function and previously specified
   * filters. Return the `request.Approve()` or `Request.Deny()` methods to approve or deny the request:
   *
   * @since 0.13.0
   *
   * @example
   * ```ts
   * When(a.Deployment)
   *  .IsCreated()
   *  .Validate(request => {
   *    if (request.HasLabel("foo")) {
   *     return request.Approve();
   *    }
   *
   *   return request.Deny("Deployment must have label foo");
   * });
   * ```
   *
   * @param action The action to be executed when the Kubernetes resource is processed by the AdmissionController.
   */
  Validate: (action: ValidateAction<T, InstanceType<T>>) => ValidateActionChain<T>;
};

export type MutateAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  req: PeprMutateRequest<K>,
  logger?: Logger,
) => Promise<void> | void | Promise<PeprMutateRequest<K>> | PeprMutateRequest<K>;

export type ValidateAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  req: PeprValidateRequest<K>,
  logger?: Logger,
) => Promise<ValidateActionResponse> | ValidateActionResponse;

// Define WatchLogAction by adding an optional logger parameter to the WatchAction
export type WatchLogAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  update: K,
  phase: WatchPhase,
  logger?: Logger,
) => Promise<void> | void;

export type ValidateActionResponse = {
  allowed: boolean;
  statusCode?: number;
  statusMessage?: string;
};

export type FinalizeAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  update: K,
  logger?: Logger,
) => Promise<boolean | void> | boolean | void;

export type FinalizeActionChain<T extends GenericClass> = {
  /**
   * Establish a finalizer for the specified resource. The callback given will be executed by the watch
   * controller after it has received notification of an update adding a deletionTimestamp.
   *
   * **Beta Function**: This method is still in early testing and edge cases may still exist.
   *
   * @since 0.35.0
   *
   * @param action
   * @returns
   */
  Finalize: (action: FinalizeAction<T, InstanceType<T>>) => void;
};

/**
 * A Kubernetes admission request to be processed by a capability.
 */
export interface AdmissionRequest<T = KubernetesObject> {
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

  /** OldObject is the existing object. Only populated for UPDATE or DELETE requests. */
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

/**
 * GroupVersionResource unambiguously identifies a resource. It doesn't anonymously include GroupVersion
 * to avoid automatic coercion. It doesn't use a GroupVersion to avoid custom marshalling
 */
export interface GroupVersionResource {
  readonly group: string;
  readonly version: string;
  readonly resource: string;
}
// DeepPartial utility type for deep optional properties
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
