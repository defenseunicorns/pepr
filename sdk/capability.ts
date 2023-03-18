// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, GroupVersionKind } from "@k8s";
import { CapabilityCfg, EventType, HookPhase } from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityCfg {
  private _name: string;
  private _description: string;
  private _namespaces?: string[] | undefined;

  // Currently everything is considered a mutation
  private _mutateOrValidate = HookPhase.mutate;

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
      IsCreated: () => this.EventBinding(EventType.create, kind),
      IsUpdated: () => this.EventBinding(EventType.update, kind),
      IsDeleted: () => this.EventBinding(EventType.delete, kind),
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
  EventBinding(event: EventType, kind: GroupVersionKind) {
    return {
      /**
       * The action that will be executed if the resources matches the binding.
       * @param binding The capability action to be executed when the Kubernetes resource is processed by the AdmissionController.
       */
      Run: <T>(binding: (request: AdmissionRequest<T>) => void) => {},
    };
  }
}
