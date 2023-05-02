// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject, Request } from "./k8s";
import { DeepPartial } from "./types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class RequestWrapper<T extends KubernetesObject> {
  private readonly _input: Request<T>;

  /**
   * The raw Kubernetes resource object.
   */
  public readonly Raw: T;

  /**
   * Indicates whether side effects are permitted for the request.
   */
  get PermitSideEffects(): boolean {
    return !this._input.dryRun;
  }

  /**
   * Indicates whether the request is a dry run.
   */
  get IsDryRun(): boolean {
    return this._input.dryRun;
  }

  /**
   * The old Kubernetes resource object, if available.
   */
  get OldResource(): T | null {
    return this._input.oldObject ?? null;
  }

  /**
   * The request object containing the Kubernetes resource.
   */
  get Request(): Request<T> {
    return this._input;
  }

  /**
   * Creates a new instance of the RequestWrapper class.
   * @param input - The request object containing the Kubernetes resource to modify.
   */
  constructor(input: Request<T>) {
    this._input = input;
    this.Raw = Object.assign({}, input.object);
    Object.freeze(this.Raw);
  }

  /**
   * Deep merges the provided object with the current resource.
   * @param obj - The object to merge with the current resource.
   */
  Merge(obj: DeepPartial<T>): void {
    Object.assign(this.Raw, obj);
  }

  /**
   * Updates a label on the Kubernetes resource.
   * @param key - The key of the label to update.
   * @param value - The value of the label.
   * @returns The current RequestWrapper instance for method chaining.
   */
  SetLabel(key: string, value: string): RequestWrapper<T> {
    const metadata = this.Raw.metadata ?? {};
    metadata.labels = metadata.labels ?? {};
    metadata.labels[key] = value;
    return this;
  }

  /**
   * Updates an annotation on the Kubernetes resource.
   * @param key - The key of the annotation to update.
   * @param value - The value of the annotation.
   * @returns The current RequestWrapper instance for method chaining.
   */
  SetAnnotation(key: string, value: string): RequestWrapper<T> {
    const metadata = this.Raw.metadata ?? {};
    metadata.annotations = metadata.annotations ?? {};
    metadata.annotations[key] = value;
    return this;
  }

  /**
   * Removes a label from the Kubernetes resource.
   * @param key - The key of the label to remove.
   * @returns The current RequestWrapper instance for method chaining.
   */
  RemoveLabel(key: string): RequestWrapper<T> {
    const metadata = this.Raw.metadata ?? {};
    if (metadata.labels?.hasOwnProperty(key)) {
      delete metadata.labels[key];
    }
    return this;
  }

  /**
   * Removes an annotation from the Kubernetes resource.
   * @param key - The key of the annotation to remove.
   * @returns The current RequestWrapper instance for method chaining.
   */
  RemoveAnnotation(key: string): RequestWrapper<T> {
    const metadata = this.Raw.metadata ?? {};
    if (metadata.annotations?.hasOwnProperty(key)) {
      delete metadata.annotations[key];
    }
    return this;
  }

  /**
   * Checks if a label exists on the Kubernetes resource.
   * @param key - The label key to check.
   * @returns true if the label exists, false otherwise.
   */
  HasLabel(key: string): boolean {
    return this.Raw?.metadata?.labels?.hasOwnProperty(key) ?? false;
  }

  /**
   * Checks if an annotation exists on the Kubernetes resource.
   * @param key - The annotation key to check.
   * @returns true if the annotation exists, false otherwise.
   */
  HasAnnotation(key: string): boolean {
    return this.Raw?.metadata?.annotations?.hasOwnProperty(key) ?? false;
  }
}