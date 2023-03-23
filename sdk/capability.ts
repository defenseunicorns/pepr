// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind } from "@k8s";
import { KubernetesObject } from "./k8s-models/types";
import {
  Binding,
  BindToAction,
  BindingFilter,
  CapabilityAction,
  CapabilityCfg,
  Event,
  HookPhase,
  WhenSelector
} from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityCfg {
  private _name: string;
  private _description: string;
  private _namespaces?: string[] | undefined;

  // Currently everything is considered a mutation
  private _mutateOrValidate = HookPhase.mutate;

  private _bindings: Binding[] = [];

  get bindings(): Binding[] {
    return { ...this._bindings };
  }

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

  /**
   * The Register method is used to register a capability with the Pepr runtime. This method is
   * called in the order that the capabilities should be executed.
   *
   * @param callback the state register method to call, passing the capability as an argument
   */
  Register(register: (self: Capability) => void) {
    register(this);
  }

  /**
   * The When method is used to register a capability action to be executed when a Kubernetes resource is
   * processed by Pepr. The action will be executed if the resource matches the specified kind and any
   * filters that are applied.
   *
   * @param kind
   * @returns
   */
  When(kind: GroupVersionKind): WhenSelector {
    return {
      IsCreatedOrUpdated: () => this._bind(Event.CreateOrUpdate, kind),
      IsCreated: () => this._bind(Event.Create, kind),
      IsUpdated: () => this._bind(Event.Update, kind),
      IsDeleted: () => this._bind(Event.Delete, kind),
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
  private _bind(event: Event, kind: GroupVersionKind) {
    const binding: Binding = {
      event,
      kind,
      filters: {
        namespaces: [],
        labels: {},
        annotations: {},
      },
    };

    const Then = <T = KubernetesObject>(cb: CapabilityAction<T>): BindToAction => {
      // Push the binding to the list of bindings for this capability as a new BindingAction
      // with the callback function to preserve
      this._bindings.push({
        ...binding,
        callback: cb,
      });

      // Now only allow adding actions to the same binding
      return { Then };
    };

    function InNamespace(namespace: string): BindingFilter {
      binding.filters.namespaces.push(namespace);
      return { WithLabel, WithAnnotation, Then };
    }

    function InOneOfNamespaces(...namespaces: string[]): BindingFilter {
      binding.filters.namespaces.push(...namespaces);
      return { WithLabel, WithAnnotation, Then };
    }

    function WithLabel(key: string, value = "*"): BindingFilter {
      binding.filters.labels[key] = value;
      return { WithLabel, WithAnnotation, Then };
    }

    const WithAnnotation = (key: string, value = "*"): BindingFilter => {
      binding.filters.annotations[key] = value;
      return { WithLabel, WithAnnotation, Then };
    };

    return {
      InNamespace,
      InOneOfNamespaces,
      WithLabel,
      WithAnnotation,
      Then,
    };
  }
}
