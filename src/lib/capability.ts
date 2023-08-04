// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { modelToGroupVersionKind } from "./k8s/index";
import { GroupVersionKind } from "./k8s/types";
import Log from "./logger";
import { PeprStore, Storage } from "./storage";
import {
  Binding,
  BindingFilter,
  BindingWithName,
  CapabilityCfg,
  CapabilityMutateAction,
  CapabilityValidateAction,
  CapabilityWatchAction,
  Event,
  GenericClass,
  MutateActionChain,
  ValidateActionChain,
  WhenSelector,
} from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityCfg {
  private _name: string;
  private _description: string;
  private _namespaces?: string[] | undefined;

  private _bindings: Binding[] = [];

  private _store = new Storage();

  private _registered = false;

  /**
   * Store is a key-value data store that can be used to persist data that should be shared
   * between requests. Each capability has its own store, and the data is persisted in Kubernetes
   * in the `pepr-system` namespace.
   *
   * Note: You should only access the store from within a capability action.
   */
  Store: PeprStore = {
    clear: this._store.clear,
    getItem: this._store.getItem,
    removeItem: this._store.removeItem,
    setItem: this._store.setItem,
    subscribe: this._store.subscribe,
  };

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

  /**
   * Register the store with the capability. This is called automatically by the Pepr controller.
   *
   * @param store
   */
  _registerStore = () => {
    Log.info(`Registering store for ${this._name}`);

    if (this._registered) {
      throw new Error(`Store already registered for ${this._name}`);
    }

    this._registered = true;

    // Pass back any ready callback to the controller
    return {
      store: this._store,
    };
  };

  constructor(cfg: CapabilityCfg) {
    this._name = cfg.name;
    this._description = cfg.description;
    this._namespaces = cfg.namespaces;

    Log.info(`Capability ${this._name} registered`);
    Log.debug(cfg);
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
    };

    const prefix = `${this._name}: ${model.name}`;

    Log.info(`Binding created`, prefix);

    const Validate = (cb: CapabilityValidateAction<T>): ValidateActionChain<T> => {
      Log.info(`Binding action created`, prefix);
      Log.debug(cb.toString(), prefix);
      // Push the binding to the list of bindings for this capability as a new BindingAction
      // with the callback function to preserve
      this._bindings.push({
        ...binding,
        isValidate: true,
        validateCallback: cb,
      });
      return { Watch };
    };

    const Mutate = (cb: CapabilityMutateAction<T>): MutateActionChain<T> => {
      Log.info(`Binding action created`, prefix);
      Log.debug(cb.toString(), prefix);
      // Push the binding to the list of bindings for this capability as a new BindingAction
      // with the callback function to preserve
      this._bindings.push({
        ...binding,
        isMutate: true,
        mutateCallback: cb,
      });

      // Now only allow adding actions to the same binding
      return { Watch, Validate };
    };

    const Watch = (cb: CapabilityWatchAction<T>): void => {
      Log.info(`Binding action created`, prefix);
      Log.debug(cb.toString(), prefix);

      this._bindings.push({
        ...binding,
        isWatch: true,
        watchCallback: cb,
      });
    };

    function InNamespace(...namespaces: string[]): BindingWithName<T> {
      Log.debug(`Add namespaces filter ${namespaces}`, prefix);
      binding.filters.namespaces.push(...namespaces);
      return { ...commonChain, WithName };
    }

    function WithName(name: string): BindingFilter<T> {
      Log.debug(`Add name filter ${name}`, prefix);
      binding.filters.name = name;
      return commonChain;
    }

    function WithLabel(key: string, value = ""): BindingFilter<T> {
      Log.debug(`Add label filter ${key}=${value}`, prefix);
      binding.filters.labels[key] = value;
      return commonChain;
    }

    const WithAnnotation = (key: string, value = ""): BindingFilter<T> => {
      Log.debug(`Add annotation filter ${key}=${value}`, prefix);
      binding.filters.annotations[key] = value;
      return commonChain;
    };

    const commonChain = { WithLabel, WithAnnotation, Mutate, Watch, Validate };

    const bindEvent = (event: Event) => {
      binding.event = event;
      return {
        ...commonChain,
        InNamespace,
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
