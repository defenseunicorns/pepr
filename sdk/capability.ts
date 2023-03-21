// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request, GroupVersionKind } from "@k8s";
import { Action } from "./actions";
import { KubernetesObject } from "./k8s-models/types";
import { CapabilityCfg, Event as Event, HookPhase } from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityCfg {
  private _name: string;
  private _description: string;
  private _namespaces?: string[] | undefined;

  // Currently everything is considered a mutation
  private _mutateOrValidate = HookPhase.mutate;

  private _eventBindings: Binding<KubernetesObject>[] = [];

  get name() {
    return this._name;
  }

  get description() {
    return this._description;
  }

  get namespaces() {
    return this._namespaces || [];
  }

  get mutateOrValidate() {
    return this._mutateOrValidate;
  }

  constructor(cfg: CapabilityCfg) {
    this._name = cfg.name;
    this._description = cfg.description;
    this._namespaces = cfg.namespaces;
  }

  When(kind: GroupVersionKind) {
    return {
      IsCreatedOrUpdated: () => this.Bind(Event.CreateOrUpdate, kind),
      IsCreated: () => this.Bind(Event.Create, kind),
      IsUpdated: () => this.Bind(Event.Update, kind),
      IsDeleted: () => this.Bind(Event.Delete, kind),
    };
  }

  /**
   * Internal method to register a capability action to be executed when a Kubernetes resource is
   * processed by the AdmissionController.
   *
   * @param event The type of Kubernetes mutating webhook event that the capability action is registered for.
   * @param kind The Kubernetes resource Group, Version, Kind to match, e.g. `Deployment`
   * @returns
   */
  Bind(event: Event, kind: GroupVersionKind) {
    const current = {
      /**
       * The action that will be executed if the resources matches the binding.
       * @param binding The capability action to be executed when the Kubernetes resource is processed by the AdmissionController.
       */
      Then: <T = KubernetesObject>(binding: Binding<T>) => {
        this._eventBindings.push(binding);
        return current;
      },
    };

    return current;
  }
}

type Binding<T> = (input: Action<T>) => void;
