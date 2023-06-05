// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone, mergeDeepRight } from "ramda";

import { KubernetesObject, Request } from "./k8s/types";
import { DeepPartial } from "./types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprRequest<T extends KubernetesObject> {
  public Raw: T;

  get PermitSideEffects() {
    return !this._input.dryRun;
  }

  /**
   * Indicates whether the request is a dry run.
   * @returns true if the request is a dry run, false otherwise.
   */
  get IsDryRun() {
    return this._input.dryRun;
  }

  /**
   * Provides access to the old resource in the request if available.
   * @returns The old Kubernetes resource object or null if not available.
   */
  get OldResource() {
    return this._input.oldObject;
  }

  /**
   * Provides access to the request object.
   * @returns The request object containing the Kubernetes resource.
   */
  get Request() {
    return this._input;
  }

  /**
   * Creates a new instance of the Action class.
   * @param input - The request object containing the Kubernetes resource to modify.
   */
  constructor(private _input: Request<T>) {
    // Deep clone the object to prevent mutation of the original object
    this.Raw = clone(_input.object);
  }

  /**
   * Deep merges the provided object with the current resource.
   *
   * @param obj - The object to merge with the current resource.
   */
  Merge(obj: DeepPartial<T>) {
    this.Raw = mergeDeepRight(this.Raw, obj) as unknown as T;
  }

  /**
   * Updates a label on the Kubernetes resource.
   * @param key - The key of the label to update.
   * @param value - The value of the label.
   * @returns The current Action instance for method chaining.
   */
  SetLabel(key: string, value: string) {
    const ref = this.Raw;

    ref.metadata = ref.metadata ?? {};
    ref.metadata.labels = ref.metadata.labels ?? {};
    ref.metadata.labels[key] = value;

    return this;
  }

  /**
   * Updates an annotation on the Kubernetes resource.
   * @param key - The key of the annotation to update.
   * @param value - The value of the annotation.
   * @returns The current Action instance for method chaining.
   */
  SetAnnotation(key: string, value: string) {
    const ref = this.Raw;

    ref.metadata = ref.metadata ?? {};
    ref.metadata.annotations = ref.metadata.annotations ?? {};
    ref.metadata.annotations[key] = value;

    return this;
  }

  /**
   * Removes a label from the Kubernetes resource.
   * @param key - The key of the label to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveLabel(key: string) {
    if (this.Raw.metadata?.labels?.[key]) {
      delete this.Raw.metadata.labels[key];
    }
    return this;
  }

  /**
   * Removes an annotation from the Kubernetes resource.
   * @param key - The key of the annotation to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveAnnotation(key: string) {
    if (this.Raw.metadata?.annotations?.[key]) {
      delete this.Raw.metadata.annotations[key];
    }
    return this;
  }

  /**
   * Check if a label exists on the Kubernetes resource.
   *
   * @param key the label key to check
   * @returns
   */
  HasLabel(key: string) {
    return this.Raw?.metadata?.labels?.[key] !== undefined;
  }

  /**
   * Check if an annotation exists on the Kubernetes resource.
   *
   * @param key the annotation key to check
   * @returns
   */
  HasAnnotation(key: string) {
    return this.Raw?.metadata?.annotations?.[key] !== undefined;
  }
}
