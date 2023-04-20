// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind, KubernetesObject, WebhookIgnore } from "./k8s";
import { PeprRequest } from "./request";

/**
 * The behavior of this module when an error occurs.
 */
export enum ErrorBehavior {
  ignore = "ignore",
  audit = "audit",
  reject = "reject",
}

/**
 * The phase of the Kubernetes admission webhook that the capability is registered for.
 *
 * Currently only `mutate` is supported.
 */
export enum HookPhase {
  mutate = "mutate",
  validate = "validate",
}

/**
 * Recursively make all properties in T optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * The type of Kubernetes mutating webhook event that the capability action is registered for.
 */

export enum Event {
  Create = "CREATE",
  Update = "UPDATE",
  Delete = "DELETE",
  CreateOrUpdate = "CREATEORUPDATE",
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

  /**
   * FUTURE USE.
   *
   * Declare if this capability should be used for mutation or validation. Currently this is not used
   * and everything is considered a mutation.
   */
  mutateOrValidate?: HookPhase;
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
  /** The version of Pepr that the module was originally generated with */
  version?: string;
  /** A unique identifier for this Pepr module. This is automatically generated by Pepr. */
  uuid: string;
  /** A description of the Pepr module and what it does. */
  description?: string;
  /** Reject K8s resource AdmissionRequests on error. */
  onError: ErrorBehavior | string;
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
  /** Register a capability action to be executed when a Kubernetes resource is created or updated. */
  IsCreatedOrUpdated: () => BindingAll<T>;
  /** Register a capability action to be executed when a Kubernetes resource is created. */
  IsCreated: () => BindingAll<T>;
  /** Register a capability action to be executed when a Kubernetes resource is updated. */
  IsUpdated: () => BindingAll<T>;
  /** Register a capability action to be executed when a Kubernetes resource is deleted. */
  IsDeleted: () => BindingAll<T>;
};

export type Binding = {
  event?: Event;
  readonly kind: GroupVersionKind;
  readonly filters: {
    name: string;
    namespaces: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
  readonly callback: CapabilityAction<GenericClass, InstanceType<GenericClass>>;
};

export type BindingFilter<T extends GenericClass> = BindToActionOrSet<T> & {
  /**
   * Only apply the capability action if the resource has the specified label. If no value is specified, the label must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * When(a.Deployment)
   *   .IsCreated()
   *   .WithLabel("foo", "bar")
   *   .WithLabel("baz", "qux")
   *   .Then(...)
   * ```
   *
   * Will only apply the capability action if the resource has both the `foo=bar` and `baz=qux` labels.
   *
   * @param key
   * @param value
   */
  WithLabel: (key: string, value?: string) => BindingFilter<T>;
  /**
   * Only apply the capability action if the resource has the specified annotation. If no value is specified, the annotation must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * When(a.Deployment)
   *   .IsCreated()
   *   .WithAnnotation("foo", "bar")
   *   .WithAnnotation("baz", "qux")
   *   .Then(...)
   * ```
   *
   * Will only apply the capability action if the resource has both the `foo=bar` and `baz=qux` annotations.
   *
   * @param key
   * @param value
   */
  WithAnnotation: (key: string, value?: string) => BindingFilter<T>;
};

export type BindingWithName<T extends GenericClass> = BindingFilter<T> & {
  /** Only apply the capability action if the resource name matches the specified name. */
  WithName: (name: string) => BindingFilter<T>;
};

export type BindingAll<T extends GenericClass> = BindingWithName<T> & {
  /** Only apply the capability action if the resource is in one of the specified namespaces.*/
  InNamespace: (...namespaces: string[]) => BindingFilter<T>;
};

export type BindToAction<T extends GenericClass> = {
  /**
   * Create a new capability action with the specified callback function and previously specified
   * filters.
   * @param action The capability action to be executed when the Kubernetes resource is processed by the AdmissionController.
   */
  Then: (action: CapabilityAction<T, InstanceType<T>>) => BindToAction<T>;
};

export type BindToActionOrSet<T extends GenericClass> = BindToAction<T> & {
  /**
   * Merge the specified updates into the resource, this can only be used once per binding.
   * Note this is just a convenience method for `request.Merge(values)`.
   *
   * Example change the `minReadySeconds` to 3 of a deployment when it is created:
   *
   * ```ts
   * When(a.Deployment)
   *  .IsCreated()
   *  .ThenSet({ spec: { minReadySeconds: 3 } });
   * ```
   *
   * @param merge
   * @returns
   */
  ThenSet: (val: DeepPartial<InstanceType<T>>) => BindToAction<T>;
};

export type CapabilityAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  req: PeprRequest<K>
) => Promise<void> | void | Promise<PeprRequest<K>> | PeprRequest<K>;
