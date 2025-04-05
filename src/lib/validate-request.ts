// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/* eslint-disable class-methods-use-this */

import { KubernetesObject } from "kubernetes-fluent-client";

import { clone } from "ramda";
import { AdmissionRequest, ValidateActionResponse } from "./common-types";
import { Operation } from "./enums";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprValidateRequest<T extends KubernetesObject> {
  Raw: T;

  #input: AdmissionRequest<T>;

  /**
   * Provides access to the old resource in the request if available.
   * @returns The old Kubernetes resource object or null if not available.
   */
  get OldResource(): KubernetesObject | undefined {
    return this.#input.oldObject;
  }

  /**
   * Provides access to the request object.
   * @returns The request object containing the Kubernetes resource.
   */
  get Request(): AdmissionRequest<KubernetesObject> {
    return this.#input;
  }

  /**
   * Creates a new instance of the Action class.
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
      throw new Error("unable to load the request object into PeprRequest.Raw");
    }
  }

  /**
   * Check if a label exists on the Kubernetes resource.
   *
   * @param key the label key to check
   * @returns
   */
  HasLabel = (key: string): boolean => {
    return this.Raw.metadata?.labels?.[key] !== undefined;
  };

  /**
   * Check if an annotation exists on the Kubernetes resource.
   *
   * @param key the annotation key to check
   * @returns
   */
  HasAnnotation = (key: string): boolean => {
    return this.Raw.metadata?.annotations?.[key] !== undefined;
  };

  /**
   * Create a validation response that allows the request.
   *
   * @returns The validation response.
   */
  Approve = (warnings?: string[]): ValidateActionResponse => {
    return {
      allowed: true,
      warnings,
    };
  };

  /**
   * Create a validation response that denies the request.
   *
   * @param statusMessage Optional status message to return to the user.
   * @param statusCode Optional status code to return to the user.
   * @returns The validation response.
   */
  Deny = (
    statusMessage?: string,
    statusCode?: number,
    warnings?: string[],
  ): ValidateActionResponse => {
    return {
      allowed: false,
      statusCode,
      statusMessage,
      warnings,
    };
  };
}
