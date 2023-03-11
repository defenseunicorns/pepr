// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export type Capability = {
  name: string;
  description: string;
};

/**
 * Global configuration for the Pepr runtime.
 */
export type Config = {
  /**
   * Configure global exlusions that will never be processed by Pepr.
   */
  alwaysIgnore: {
    /**
     * List of K8s resource kinds to always ignore.
     */
    kinds?: string[];
    /**
     * List of K8s namespaces to always ignore, any resources in these namespaces will be ignored.
     */
    namespaces?: string[];
    /**
     * List of K8s labels to always ignore, any resources with these labels will be ignored.
     *
     * This example will ignore any resources with the label `my-label=ulta-secret`.
     *
     * ```
     * alwaysIgnore:
     *   labels: ["my-label=ulta-secret"]
     * ```
     */
    labels?: string[];
  };
};
