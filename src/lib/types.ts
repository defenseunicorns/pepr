// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass, GroupVersionKind, KubernetesObject } from "kubernetes-fluent-client";
import { Event } from "./enums";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { Logger } from "pino";
import { PeprMutateRequest } from "./mutate-request";
import { PeprValidateRequest } from "./validate-request";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import { WebhookIgnore, MutateResponse, ValidateResponse } from "./k8s";
import { AdmissionRequest, ValidateActionResponse } from "./common-types";

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

/** Custom Labels Type for package.json */

export type CustomLabels = { namespace: Record<string, string> } | Record<string, never>;
/** Configuration that MAY be set a Pepr module's package.json. */
export type ModuleConfigOptions = {
  /** The Pepr version this module uses */
  peprVersion: string;
  /** The user-defined version of the module */
  appVersion: string;
  /** A description of the Pepr module and what it does. */
  description: string;
  /** The webhookTimeout */
  webhookTimeout: number;
  /** Reject K8s resource AdmissionRequests on error. */
  onError: string;
  /** Define the log level for the in-cluster controllers */
  logLevel: string;
  /** Propagate env variables to in-cluster controllers */
  env: Record<string, string>;
  /** Custom RBAC rules */
  rbac: PolicyRule[];
  /** The RBAC mode; if "scoped", generates scoped rules, otherwise uses wildcard rules. */
  rbacMode: string;
  /** Custom Labels for Kubernetes Objects */
  customLabels: CustomLabels;
};
/** Global configuration for the Pepr runtime. */
export type ModuleConfig = {
  /** A unique identifier for this Pepr module. This is automatically generated by Pepr. */
  uuid: string;
  /** Configure global exclusions that will never be processed by Pepr. */
  alwaysIgnore: WebhookIgnore;
  /** admission specific ignore */
  admission?: {
    alwaysIgnore: WebhookIgnore;
  };
  /** watch specific ignore */
  watch?: {
    alwaysIgnore: WebhookIgnore;
  };
} & Partial<ModuleConfigOptions>;

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

export type PeprModuleOptions = {
  deferStart?: boolean;

  /** A user-defined callback to pre-process or intercept a Pepr request from K8s immediately before it is processed */
  beforeHook?: (req: AdmissionRequest) => void;

  /** A user-defined callback to post-process or intercept a Pepr response just before it is returned to K8s */
  afterHook?: (res: MutateResponse | ValidateResponse) => void;
}; // Track if this is a watch mode controller
export type AdjudicationResult = string | null;
