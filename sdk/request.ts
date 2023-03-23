// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request } from "@k8s";
import { KubernetesObject } from "./k8s-models/types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class RequestWrapper<T extends KubernetesObject> {
  private _input: Request<T>;

  /**
   *
   */
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
   * Provides access to the resource in the request.
   * @returns The Kubernetes resource object.
   */
  get Raw() {
    return this._input.object;
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
  constructor(input: Request<T>) {
    this._input = input;
  }

  /**
   * Updates a label on the Kubernetes resource.
   * @param key - The key of the label to update.
   * @param value - The value of the label.
   * @returns The current Action instance for method chaining.
   */
  SetLabel(key: string, value: string) {
    this._write("labels", key, value);
    return this;
  }

  /**
   * Updates an annotation on the Kubernetes resource.
   * @param key - The key of the annotation to update.
   * @param value - The value of the annotation.
   * @returns The current Action instance for method chaining.
   */
  SetAnnotation(key: string, value: string) {
    this._write("annotations", key, value);
    return this;
  }

  /**
   * Removes a label from the Kubernetes resource.
   * @param key - The key of the label to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveLabel(key: string) {
    this._remove("labels", key);
    return this;
  }

  /**
   * Removes an annotation from the Kubernetes resource.
   * @param key - The key of the annotation to remove.
   * @returns The current Action instance for method chaining.
   */
  RemoveAnnotation(key: string) {
    this._remove("annotations", key);
    return this;
  }

  /**
   * Check if a label exists on the Kubernetes resource.
   *
   * @param key the label key to check
   * @returns
   */
  HasLabel(key: string) {
    return this._input.object.metadata?.labels?.[key] !== undefined;
  }

  /**
   * Check if an annotation exists on the Kubernetes resource.
   *
   * @param key the annotation key to check
   * @returns
   */
  HasAnnotation(key: string) {
    return this._input.object.metadata?.annotations?.[key] !== undefined;
  }

  // Write metadata to the Kubernetes resource.
  private _write(parent: string, key: string, value: any) {
    let meta = this._input.object.metadata ?? {};
    meta[parent] = meta[parent] ?? {};
    meta[parent][key] = value;
  }

  // Remove metadata from the Kubernetes resource.
  private _remove(parent: string, key: string) {
    if (this._input.object.metadata?.[parent]) {
      delete this._input.object.metadata[parent][key];
    }
  }
}
