// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { pickBy } from "ramda";

import { isWatchMode, modelToGroupVersionKind } from "./k8s/index";
import { GroupVersionKind } from "./k8s/types";
import Log from "./logger";
import { PeprStore, Storage } from "./storage";
import {
  Binding,
  BindingFilter,
  BindingWithName,
  CapabilityCfg,
  CapabilityExport,
  Event,
  GenericClass,
  MutateAction,
  MutateActionChain,
  ValidateAction,
  ValidateActionChain,
  WatchAction,
  WhenSelector,
} from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityExport {
  #name: string;
  #description: string;
  #namespaces?: string[] | undefined;
  #bindings: Binding[] = [];
  #store = new Storage();
  #registered = false;

  /**
   * Store is a key-value data store that can be used to persist data that should be shared
   * between requests. Each capability has its own store, and the data is persisted in Kubernetes
   * in the `pepr-system` namespace.
   *
   * Note: You should only access the store from within an action.
   */
  Store: PeprStore = {
    clear: this.#store.clear,
    getItem: this.#store.getItem,
    removeItem: this.#store.removeItem,
    setItem: this.#store.setItem,
    subscribe: this.#store.subscribe,
    onReady: this.#store.onReady,
  };

  get bindings() {
    return this.#bindings;
  }

  get name() {
    return this.#name;
  }

  get description() {
    return this.#description;
  }

  get namespaces() {
    return this.#namespaces || [];
  }

  constructor(cfg: CapabilityCfg) {
    this.#name = cfg.name;
    this.#description = cfg.description;
    this.#namespaces = cfg.namespaces;

    Log.info(`Capability ${this.#name} registered`);
    Log.debug(cfg);
  }

  /**
   * Register the store with the capability. This is called automatically by the Pepr controller.
   *
   * @param store
   */
  registerStore = () => {
    Log.info(`Registering store for ${this.#name}`);

    if (this.#registered) {
      throw new Error(`Store already registered for ${this.#name}`);
    }

    this.#registered = true;

    // Pass back any ready callback to the controller
    return {
      store: this.#store,
    };
  };

  /**
   * The When method is used to register a action to be executed when a Kubernetes resource is
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

    const bindings = this.#bindings;
    const prefix = `${this.#name}: ${model.name}`;
    const commonChain = { WithLabel, WithAnnotation, Mutate, Validate, Watch };
    const isNotEmpty = (value: object) => Object.keys(value).length > 0;
    const log = (message: string, cbString: string) => {
      const filteredObj = pickBy(isNotEmpty, binding.filters);

      Log.info(`${message} configured for ${binding.event}`, prefix);
      Log.info(filteredObj, prefix);
      Log.debug(cbString, prefix);
    };

    function Validate(validateCallback: ValidateAction<T>): ValidateActionChain<T> {
      if (!isWatchMode) {
        log("Validate Action", validateCallback.toString());

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isValidate: true,
          validateCallback,
        });
      }

      return { Watch };
    }

    function Mutate(mutateCallback: MutateAction<T>): MutateActionChain<T> {
      if (!isWatchMode) {
        log("Mutate Action", mutateCallback.toString());

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isMutate: true,
          mutateCallback,
        });
      }

      // Now only allow adding actions to the same binding
      return { Watch, Validate };
    }

    function Watch(watchCallback: WatchAction<T>) {
      if (isWatchMode) {
        log("Watch Action", watchCallback.toString());

        bindings.push({
          ...binding,
          isWatch: true,
          watchCallback,
        });
      }
    }

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

    function WithAnnotation(key: string, value = ""): BindingFilter<T> {
      Log.debug(`Add annotation filter ${key}=${value}`, prefix);
      binding.filters.annotations[key] = value;
      return commonChain;
    }

    function bindEvent(event: Event) {
      binding.event = event;
      return {
        ...commonChain,
        InNamespace,
        WithName,
      };
    }

    return {
      IsCreatedOrUpdated: () => bindEvent(Event.CreateOrUpdate),
      IsCreated: () => bindEvent(Event.Create),
      IsUpdated: () => bindEvent(Event.Update),
      IsDeleted: () => bindEvent(Event.Delete),
    };
  };
}
