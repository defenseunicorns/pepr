// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject } from "kubernetes-fluent-client";
import { clone, mergeDeepRight } from "ramda";

import { AdmissionRequest, Operation } from "./k8s";
import { DeepPartial } from "./types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprMutateRequest<T extends KubernetesObject> {
  Raw: T;

  #input: AdmissionRequest<T>;

  get PermitSideEffects() {
    return !this.#input.dryRun;
  }

  /**
   * Indicates whether the request is a dry run.
   * @returns true if the request is a dry run, false otherwise.
   */
  get IsDryRun() {
    return this.#input.dryRun;
  }

  /**
   * Provides access to the old resource in the request if available.
   * @returns The old Kubernetes resource object or null if not available.
   */
  get OldResource() {
    return this.#input.oldObject;
  }

  /**
   * Provides access to the request object.
   * @returns The request object containing the Kubernetes resource.
   */
  get Request() {
    return this.#input;
  }

  /**
   * Creates a new instance of the action class.
   * @param input - The request object containing the Kubernetes resource to modify.
   */
  constructor(input: AdmissionRequest<T>) {
    this.#input = input;

    // If this is a DELETE operation, use the oldObject instead
    if (input.operation.toUpperCase() === Operation.DELETE) {
      this.Raw = clone(input.oldObject as T);
    } else {
      // Otherwise, use the incoming object
      this.Raw = clone(input.object);
    }

    if (!this.Raw) {
      throw new Error("unable to load the request object into PeprRequest.RawP");
    }
  }

  /**
   * Deep merges the provided object with the current resource.
   *
   * @param obj - The object to merge with the current resource.
   */
  Merge = (obj: DeepPartial<T>) => {
    this.Raw = mergeDeepRight(this.Raw, obj) as unknown as T;
  };

  /**
   * Updates a label on the Kubernetes resource.
   * @param key - The key of the label to update.
   * @param value - The value of the label.
   * @returns The current action instance for method chaining.
   */
  SetLabel = (key: string, value: string) => {
    const ref = this.Raw;

    ref.metadata = ref.metadata ?? {};
    ref.metadata.labels = ref.metadata.labels ?? {};
    ref.metadata.labels[key] = value;

    return this;
  };

  /**
   * Updates an annotation on the Kubernetes resource.
   * @param key - The key of the annotation to update.
   * @param value - The value of the annotation.
   * @returns The current action instance for method chaining.
   */
  SetAnnotation = (key: string, value: string) => {
    const ref = this.Raw;

    ref.metadata = ref.metadata ?? {};
    ref.metadata.annotations = ref.metadata.annotations ?? {};
    ref.metadata.annotations[key] = value;

    return this;
  };

  /**
   * Removes a label from the Kubernetes resource.
   * @param key - The key of the label to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveLabel = (key: string) => {
    if (this.Raw.metadata?.labels?.[key]) {
      delete this.Raw.metadata.labels[key];
    }

    return this;
  };

  /**
   * Removes an annotation from the Kubernetes resource.
   * @param key - The key of the annotation to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveAnnotation = (key: string) => {
    if (this.Raw.metadata?.annotations?.[key]) {
      delete this.Raw.metadata.annotations[key];
    }

    return this;
  };

  /**
   * Check if a label exists on the Kubernetes resource.
   *
   * @param key the label key to check
   * @returns
   */
  HasLabel = (key: string) => {
    return this.Raw.metadata?.labels?.[key] !== undefined;
  };

  /**
   * Check if an annotation exists on the Kubernetes resource.
   *
   * @param key the annotation key to check
   * @returns
   */
  HasAnnotation = (key: string) => {
    return this.Raw.metadata?.annotations?.[key] !== undefined;
  };
}
