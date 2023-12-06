// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass, GroupVersionKind, KubernetesObject } from "kubernetes-fluent-client";
import { WatchAction } from "kubernetes-fluent-client/dist/fluent/types";

import { PeprMutateRequest } from "./mutate-request";
import { PeprValidateRequest } from "./validate-request";

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
/**
 * Recursively make all properties in T optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * The type of Kubernetes mutating webhook event that the action is registered for.
 */
export enum Event {
  Create = "CREATE",
  Update = "UPDATE",
  Delete = "DELETE",
  CreateOrUpdate = "CREATEORUPDATE",
  Any = "*",
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

export type Binding = {
  event: Event;
  isMutate?: boolean;
  isValidate?: boolean;
  isWatch?: boolean;
  readonly model: GenericClass;
  readonly kind: GroupVersionKind;
  readonly filters: {
    name: string;
    namespaces: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
  readonly mutateCallback?: MutateAction<GenericClass, InstanceType<GenericClass>>;
  readonly validateCallback?: ValidateAction<GenericClass, InstanceType<GenericClass>>;
  readonly watchCallback?: WatchAction<GenericClass, InstanceType<GenericClass>>;
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
};

export type BindingWithName<T extends GenericClass> = BindingFilter<T> & {
  /** Only apply the action if the resource name matches the specified name. */
  WithName: (name: string) => BindingFilter<T>;
};

export type BindingAll<T extends GenericClass> = BindingWithName<T> & {
  /** Only apply the action if the resource is in one of the specified namespaces.*/
  InNamespace: (...namespaces: string[]) => BindingWithName<T>;
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
  Watch: (action: WatchAction<T, InstanceType<T>>) => void;
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
) => Promise<void> | void | Promise<PeprMutateRequest<K>> | PeprMutateRequest<K>;

export type ValidateAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  req: PeprValidateRequest<K>,
) => Promise<ValidateActionResponse> | ValidateActionResponse;

export type ValidateActionResponse = {
  allowed: boolean;
  statusCode?: number;
  statusMessage?: string;
};
