// SPDX-License-Identifier: Apache-2.0

import { GroupVersionKind } from "@k8s";
import { Action } from "./actions";
import { KubernetesObject } from "./k8s-models/types";

/**
 * The phase of the Kubernetes admission webhook that the capability is registered for.
 *
 * Currently only `mutate` is supported.
 */
export enum HookPhase {
  mutate = "mutate",
  valdiate = "validate",
}

/**
 * Recursively make all properties in T optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * The type of Kubernetes mutating webhook event ethat the capability action is registered for.
 */

export enum Event {
  Create = "create",
  Update = "update",
  Delete = "delete",
  CreateOrUpdate = "createOrUpdate",
}

export interface MutateBinding {
  (): void;
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

/**
 * Global configuration for the Pepr runtime.
 */
export type Config = {
  /**
   * Configure global exclusions that will never be processed by Pepr.
   */
  alwaysIgnore: {
    /**
     * List of Kubernetes resource kinds to always ignore.
     * This prevents Pepr from processing the specified resource kinds.
     */
    kinds?: GroupVersionKind[];
    /**
     * List of Kubernetes namespaces to always ignore.
     * Any resources in these namespaces will be ignored by Pepr.
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

  /**
   * FUTURE USE.
   *
   * Configure the signing policy for Pepr capabilities.
   * This setting determines the requirements for signing keys in Pepr.
   */
  signing?: {
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
};

export type WhenSelector = {
  /** Register a capability action to be executed when a Kubernetes resource is created or updated. */
  IsCreatedOrUpdated: () => BindingAll;
  /** Register a capability action to be executed when a Kubernetes resource is created. */
  IsCreated: () => BindingAll;
  /** Register a capability action to be executed when a Kubernetes resource is updated. */
  IsUpdated: () => BindingAll;
  /** Register a capability action to be executed when a Kubernetes resource is deleted. */
  IsDeleted: () => BindingAll;
};

export type Binding = {
  readonly event: Event;
  readonly kind: GroupVersionKind;
  readonly filters: {
    namespaces?: string[];
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  readonly callback?: Callback<KubernetesObject>;
};

export type BindingFilter = BindingAction & {
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
  WithLabel: (key: string, value?: string) => BindingFilter;
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
  WithAnnotation: (key: string, value?: string) => BindingFilter;
};

export type BindingAll = BindingFilter & {
  /** Only apply the capability action to resources in the specified namespace.*/
  InNamespace: (namespace: string) => BindingFilter;
  /** Only apply the cabability action if the resource is in one of the specified namespaces.*/
  InOneOfNamespaces: (...namespaces: string[]) => BindingFilter;
};

export type BindingAction = {
  /**
   * The action that will be executed if the resources matches the binding.
   * @param cb The capability action to be executed when the Kubernetes resource is processed by the AdmissionController.
   */
  Then: <T>(cb: Callback<T>) => BindingAction;
};

export type Callback<T> = (input: Action<T>) => void;
