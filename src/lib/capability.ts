// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { modelToGroupVersionKind } from "./k8s/index";
import { GroupVersionKind } from "./k8s/types";
import logger from "./logger";
import {
  BindToAction,
  Binding,
  BindingFilter,
  BindingWithName,
  CapabilityAction,
  CapabilityCfg,
  DeepPartial,
  Event,
  GenericClass,
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
    return this._bindings;
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
    logger.info(`Capability ${this._name} registered`);
    logger.debug(cfg);
  }

  /**
   * The When method is used to register a capability action to be executed when a Kubernetes resource is
   * processed by Pepr. The action will be executed if the resource matches the specified kind and any
   * filters that are applied.
   *
   * @param model the KubernetesObject model to match
   * @param kind if using a custom KubernetesObject not available in `a.*`, specify the GroupVersionKind
   * @returns
   */
  When = <T extends GenericClass>(model: T, kind?: GroupVersionKind): WhenSelector<T> => {
    const matchedKind = modelToGroupVersionKind(model.name);

    // If the kind is not specified and the model is not a KubernetesObject, throw an error
    if (!matchedKind && !kind) {
      throw new Error(`Kind not specified for ${model.name}`);
    }

    const binding: Binding = {
      // If the kind is not specified, use the matched kind from the model
      kind: kind || matchedKind,
      event: Event.Any,
      filters: {
        name: "",
        namespaces: [],
        labels: {},
        annotations: {},
      },
      callback: () => undefined,
    };

    const prefix = `${this._name}: ${model.name}`;

    logger.info(`Binding created`, prefix);

    const Then = (cb: CapabilityAction<T>): BindToAction<T> => {
      logger.info(`Binding action created`, prefix);
      logger.debug(cb.toString(), prefix);
      // Push the binding to the list of bindings for this capability as a new BindingAction
      // with the callback function to preserve
      this._bindings.push({
        ...binding,
        callback: cb,
      });

      // Now only allow adding actions to the same binding
      return { Then };
    };

    const ThenSet = (merge: DeepPartial<InstanceType<T>>): BindToAction<T> => {
      // Add the new action to the binding
      Then(req => req.Merge(merge));

      return { Then };
    };

    function InNamespace(...namespaces: string[]): BindingWithName<T> {
      logger.debug(`Add namespaces filter ${namespaces}`, prefix);
      binding.filters.namespaces.push(...namespaces);
      return { WithLabel, WithAnnotation, WithName, Then, ThenSet };
    }

    function WithName(name: string): BindingFilter<T> {
      logger.debug(`Add name filter ${name}`, prefix);
      binding.filters.name = name;
      return { WithLabel, WithAnnotation, Then, ThenSet };
    }

    function WithLabel(key: string, value = ""): BindingFilter<T> {
      logger.debug(`Add label filter ${key}=${value}`, prefix);
      binding.filters.labels[key] = value;
      return { WithLabel, WithAnnotation, Then, ThenSet };
    }

    const WithAnnotation = (key: string, value = ""): BindingFilter<T> => {
      logger.debug(`Add annotation filter ${key}=${value}`, prefix);
      binding.filters.annotations[key] = value;
      return { WithLabel, WithAnnotation, Then, ThenSet };
    };

    const bindEvent = (event: Event) => {
      binding.event = event;
      return {
        InNamespace,
        Then,
        ThenSet,
        WithAnnotation,
        WithLabel,
        WithName,
      };
    };

    return {
      IsCreatedOrUpdated: () => bindEvent(Event.CreateOrUpdate),
      IsCreated: () => bindEvent(Event.Create),
      IsUpdated: () => bindEvent(Event.Update),
      IsDeleted: () => bindEvent(Event.Delete),
    };
  };
}
