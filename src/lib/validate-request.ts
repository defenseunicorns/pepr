// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/* eslint-disable class-methods-use-this */

import { clone } from "ramda";
import { KubernetesObject, Operation, Request } from "./k8s/types";
import { ValidateResponse } from "./types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprValidateRequest<T extends KubernetesObject> {
  public Raw: T;

  #input: Request<T>;

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
   * Creates a new instance of the Action class.
   * @param input - The request object containing the Kubernetes resource to modify.
   */
  constructor(input: Request<T>) {
    this.#input = input;

    // Bind public methods to this instance
    this.HasLabel = this.HasLabel.bind(this);
    this.HasAnnotation = this.HasAnnotation.bind(this);
    this.Approve = this.Approve.bind(this);
    this.Deny = this.Deny.bind(this);

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
   * Check if a label exists on the Kubernetes resource.
   *
   * @param key the label key to check
   * @returns
   */
  HasLabel(key: string) {
    return this.Raw.metadata?.labels?.[key] !== undefined;
  }

  /**
   * Check if an annotation exists on the Kubernetes resource.
   *
   * @param key the annotation key to check
   * @returns
   */
  HasAnnotation(key: string) {
    return this.Raw.metadata?.annotations?.[key] !== undefined;
  }

  /**
   * Create a validation response that allows the request.
   *
   * @returns The validation response.
   */
  Approve(): ValidateResponse {
    return {
      allowed: true,
    };
  }

  /**
   * Create a validation response that denies the request.
   *
   * @param statusMessage Optional status message to return to the user.
   * @param statusCode Optional status code to return to the user.
   * @returns The validation response.
   */
  Deny(statusMessage?: string, statusCode?: number): ValidateResponse {
    return {
      allowed: false,
      statusCode,
      statusMessage,
    };
  }
}
