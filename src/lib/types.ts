// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind, KubernetesObject, PeprRequest, WebhookIgnore } from './k8s';

/**
 * The behavior of this module when an error occurs.
 */
export enum ErrorBehavior {
  ignore = 'ignore',
  audit = 'audit',
  reject = 'reject',
}

/**
 * The phase of the Kubernetes admission webhook that the capability is registered for.
 *
 * Currently only `mutate` is supported.
 */
export enum HookPhase {
  mutate = 'mutate',
  validate = 'validate',
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
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  CreateOrUpdate = 'CREATEORUPDATE',
}

/**
 * Configuration for a Pepr capability.
 */
export interface CapabilityConfig {
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
  signing?: {
    /**
     * Specifies the signing policy.
     * "requireAuthorizedKey" - only authorized keys are accepted.
     * "requireAnyKey" - any key is accepted, as long as it's valid.
     * "none" - no signing required.
     */
    signingPolicy?: 'requireAuthorizedKey' | 'requireAnyKey' | 'none';
    /**
     * List of authorized keys for the "requireAuthorizedKey" policy.
     * These keys are allowed to sign Pepr capabilities.
     */
    authorizedKeys?: string[];
  };
};

/**
 * A class constructor.
 */
export type GenericClass = abstract new () => unknown;

/**
 * A selector for a Pepr capability.
 */
export type CapabilitySelector<T extends GenericClass> = {
  /** Register a capability action to be executed when a Kubernetes resource is created or updated. */
  IsCreatedOrUpdated: () => CapabilityBinding<T>;
  /** Register a capability action to be executed when a Kubernetes resource is created. */
  IsCreated: () => CapabilityBinding<T>;
  /** Register a capability action to be executed when a Kubernetes resource is updated. */
  IsUpdated: () => CapabilityBinding<T>;
  /** Register a capability action to be executed when a Kubernetes resource is deleted. */
  IsDeleted: () => CapabilityBinding<T>;
};

/**
 * A binding for a Pepr capability.
 */
export type CapabilityBinding<T extends GenericClass> = {
  event?: Event;
  readonly kind: GroupVersionKind;
  readonly filters: {
    readonly name: string;
    readonly namespaces: readonly string[];
    readonly labels: Readonly<Record<string, string>>;
    readonly annotations: Readonly<Record<string, string>>;
  };
  readonly callback: CapabilityAction<T>;
};

/**
 * A filter for a Pepr capability binding.
 */
export type CapabilityFilter<T extends GenericClass> = BindToActionOrSet<T> & {
  /**
   * Only apply the capability action if the resource has the specified label. If no value is specified, the label must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   *