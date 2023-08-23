// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";
import { KubernetesObject, Operation, Request } from "./k8s/types";
import { ValidateResponse } from "./types";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprValidateRequest<T extends KubernetesObject> {
  public Raw: T;

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
  constructor(protected _input: Request<T>) {
    // If this is a DELETE operation, use the oldObject instead
    if (_input.operation.toUpperCase() === Operation.DELETE) {
      this.Raw = clone(_input.oldObject as T);
    } else {
      // Otherwise, use the incoming object
      this.Raw = clone(_input.object);
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
