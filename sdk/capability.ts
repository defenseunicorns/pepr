// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind } from "@k8s";
import {
  Binding,
  BindingFilter,
  BindToAction,
  CapabilityAction,
  CapabilityCfg,
  Event,
  HookPhase,
  WhenSelector,
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
    const binding: Binding = {
      kind,
      filters: {
        namespaces: [],
        labels: {},
        annotations: {},
      },
    };

    const Then = <T>(cb: CapabilityAction<T>): BindToAction => {
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

    const bindEvent = (event: Event) => {
      binding.event = event;
      return {
        InNamespace,
        InOneOfNamespaces,
        WithLabel,
        WithAnnotation,
        Then,
      };
    };

    return {
      IsCreatedOrUpdated: () => bindEvent(Event.CreateOrUpdate),
      IsCreated: () => bindEvent(Event.Create),
      IsUpdated: () => bindEvent(Event.Update),
      IsDeleted: () => bindEvent(Event.Delete),
    };
  }
}
