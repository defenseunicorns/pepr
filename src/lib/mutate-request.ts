// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, DeepPartial } from "./types";
import { Operation } from "./enums";
import { KubernetesObject } from "kubernetes-fluent-client";
import { clone, mergeDeepRight } from "ramda";
import { Logger } from "pino";
import { GenericClass } from "kubernetes-fluent-client";

// MutateAction type for handling mutation callbacks
export type MutateAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  req: PeprMutateRequest<K>,
  logger?: Logger,
) => Promise<void> | void | Promise<PeprMutateRequest<K>> | PeprMutateRequest<K>;

// PeprMutateRequest class for mutation request handling
export class PeprMutateRequest<T extends KubernetesObject> {
  Raw: T;
  #input: AdmissionRequest<T>;

  get PermitSideEffects() {
    return !this.#input.dryRun;
  }

  get IsDryRun() {
    return this.#input.dryRun;
  }

  get OldResource() {
    return this.#input.oldObject;
  }

  get Request() {
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

  Merge = (obj: DeepPartial<T>) => {
    this.Raw = mergeDeepRight(this.Raw, obj) as unknown as T;
  };

  SetLabel = (key: string, value: string) => {
    const ref = this.Raw;
    ref.metadata = ref.metadata ?? {};
    ref.metadata.labels = ref.metadata.labels ?? {};
    ref.metadata.labels[key] = value;
    return this;
  };

  SetAnnotation = (key: string, value: string) => {
    const ref = this.Raw;
    ref.metadata = ref.metadata ?? {};
    ref.metadata.annotations = ref.metadata.annotations ?? {};
    ref.metadata.annotations[key] = value;
    return this;
  };

  RemoveLabel = (key: string) => {
    if (this.Raw.metadata?.labels?.[key]) {
      delete this.Raw.metadata.labels[key];
    }
    return this;
  };

  RemoveAnnotation = (key: string) => {
    if (this.Raw.metadata?.annotations?.[key]) {
      delete this.Raw.metadata.annotations[key];
    }
    return this;
  };

  HasLabel = (key: string) => {
    return this.Raw.metadata?.labels?.[key] !== undefined;
  };

  HasAnnotation = (key: string) => {
    return this.Raw.metadata?.annotations?.[key] !== undefined;
  };
}
