// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request } from "@k8s";

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
    kinds?: string[];
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
     *   labels: ["my-label=ulta-secret"]
     * ```
     */
    labels?: string[];
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
