// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "./enums";
import { KubernetesObject } from "kubernetes-fluent-client";
import { clone, mergeDeepRight } from "ramda";
import { AdmissionRequest } from "./common-types";
import { DeepPartial } from "./utility-types";

// PeprMutateRequest class for mutation request handling
export class PeprMutateRequest<T extends KubernetesObject> {
  Raw: T;
  #input: AdmissionRequest<T>;

  get PermitSideEffects(): boolean {
    return !this.#input.dryRun;
  }

  get IsDryRun(): boolean | undefined {
    return this.#input.dryRun;
  }

  get OldResource(): KubernetesObject | undefined {
    return this.#input.oldObject;
  }

  get Request(): AdmissionRequest<KubernetesObject> {
    return this.#input;
  }

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
      throw new Error("Unable to load the request object into PeprRequest.Raw");
    }
  }

  Merge = (obj: DeepPartial<T>): void => {
    this.Raw = mergeDeepRight(this.Raw, obj) as unknown as T;
  };

  SetLabel = (key: string, value: string): this => {
    const ref = this.Raw;
    ref.metadata = ref.metadata ?? {};
    ref.metadata.labels = ref.metadata.labels ?? {};
    ref.metadata.labels[key] = value;
    return this;
  };

  SetAnnotation = (key: string, value: string): this => {
    const ref = this.Raw;
    ref.metadata = ref.metadata ?? {};
    ref.metadata.annotations = ref.metadata.annotations ?? {};
    ref.metadata.annotations[key] = value;
    return this;
  };

  RemoveLabel = (key: string): this => {
    if (this.Raw.metadata?.labels?.[key]) {
      delete this.Raw.metadata.labels[key];
    }
    return this;
  };

  RemoveAnnotation = (key: string): this => {
    if (this.Raw.metadata?.annotations?.[key]) {
      delete this.Raw.metadata.annotations[key];
    }
    return this;
  };

  HasLabel = (key: string): boolean => {
    return this.Raw.metadata?.labels?.[key] !== undefined;
  };

  HasAnnotation = (key: string): boolean => {
    return this.Raw.metadata?.annotations?.[key] !== undefined;
  };
}
