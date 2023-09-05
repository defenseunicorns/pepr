// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind, KubernetesObject, WebhookIgnore } from "./k8s/types";
import { PeprMutateRequest } from "./mutate-request";
import { PeprValidateRequest } from "./validate-request";

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

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

/**
 * The Phase matched when using the K8s Watch API.
 */
export enum WatchPhase {
  Added = "ADDED",
  Modified = "MODIFIED",
  Deleted = "DELETED",
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
}

export type ModuleSigning = {
  /**
   * Specifies the signing policy.
   * "requireAuthorizedKey" - only authorized keys are accepted.
   * "requireAnyKey" - any key is accepted, as long as it's valid.
   * "none" - no signing required.
   */
  signingPolicy?: "requireAuthorizedKey" | "requireAnyKey" | "none";
  /**
   * List of authorized keys for the "requireAuthorizedKey" policy.
   * These keys are allowed to sign Pepr capabilities.
   */
  authorizedKeys?: string[];
};

/** Global configuration for the Pepr runtime. */
export type ModuleConfig = {
  /** The user-defined name for the module */
  name: string;
  /** The Pepr version this module uses */
  peprVersion?: string;
  /** The user-defined version of the module */
  appVersion?: string;
  /** A unique identifier for this Pepr module. This is automatically generated by Pepr. */
  uuid: string;
  /** A description of the Pepr module and what it does. */
  description?: string;
  /** Reject K8s resource AdmissionRequests on error. */
  onError?: string;
  /** Configure global exclusions that will never be processed by Pepr. */
  alwaysIgnore: WebhookIgnore;
  /**
   * FUTURE USE.
   *
   * Configure the signing policy for Pepr capabilities.
   * This setting determines the requirements for signing keys in Pepr.
   */
  signing?: ModuleSigning;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericClass = abstract new () => any;

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
   * @param action The action to be executed when the Kubernetes resource is processed by the AdmissionController.
   */
  Mutate: (action: MutateAction<T, InstanceType<T>>) => MutateActionChain<T>;
};

export type ValidateActionChain<T extends GenericClass> = {
  /**
   * Establish a watcher for the specified resource. The callback function will be executed after the admission controller has
   * processed the resource and the request has been persisted to the cluster.
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
) => Promise<ValidateResponse> | ValidateResponse;

export type WatchAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  update: K,
  phase: WatchPhase,
) => Promise<void> | void;

export type ValidateResponse = {
  allowed: boolean;
  statusCode?: number;
  statusMessage?: string;
};
