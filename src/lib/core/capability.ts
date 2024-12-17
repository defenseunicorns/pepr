// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass, GroupVersionKind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import { pickBy } from "ramda";
import Log from "../telemetry/logger";
import { isBuildMode, isDevMode, isWatchMode } from "./module";
import { PeprStore, Storage } from "./storage";
import { OnSchedule, Schedule } from "./schedule";
import { Event } from "../enums";
import {
  Binding,
  BindingFilter,
  BindingWithName,
  CapabilityCfg,
  CapabilityExport,
  MutateAction,
  MutateActionChain,
  ValidateAction,
  ValidateActionChain,
  WatchLogAction,
  FinalizeAction,
  FinalizeActionChain,
  WhenSelector,
} from "../types";
import { addFinalizer } from "../finalizer";

const registerAdmission = isBuildMode() || !isWatchMode();
const registerWatch = isBuildMode() || isWatchMode() || isDevMode();

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityExport {
  #name: string;
  #description: string;
  #namespaces?: string[] | undefined;
  #bindings: Binding[] = [];
  #store = new Storage();
  #scheduleStore = new Storage();
  #registered = false;
  #scheduleRegistered = false;
  hasSchedule: boolean;

  /**
   * Run code on a schedule with the capability.
   *
   * @param schedule The schedule to run the code on
   * @returns
   */
  OnSchedule: (schedule: Schedule) => void = (schedule: Schedule) => {
    const { name, every, unit, run, startTime, completions } = schedule;
    this.hasSchedule = true;

    if (process.env.PEPR_WATCH_MODE === "true" || process.env.PEPR_MODE === "dev") {
      // Only create/watch schedule store if necessary

      // Create a new schedule
      const newSchedule: Schedule = {
        name,
        every,
        unit,
        run,
        startTime,
        completions,
      };

      this.#scheduleStore.onReady(() => {
        new OnSchedule(newSchedule).setStore(this.#scheduleStore);
      });
    }
  };

  public getScheduleStore(): Storage {
    return this.#scheduleStore;
  }

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
    removeItemAndWait: this.#store.removeItemAndWait,
    setItem: this.#store.setItem,
    subscribe: this.#store.subscribe,
    onReady: this.#store.onReady,
    setItemAndWait: this.#store.setItemAndWait,
  };

  /**
   * ScheduleStore is a key-value data store used to persist schedule data that should be shared
   * between intervals. Each Schedule shares store, and the data is persisted in Kubernetes
   * in the `pepr-system` namespace.
   *
   * Note: There is no direct access to schedule store
   */
  ScheduleStore: PeprStore = {
    clear: this.#scheduleStore.clear,
    getItem: this.#scheduleStore.getItem,
    removeItemAndWait: this.#scheduleStore.removeItemAndWait,
    removeItem: this.#scheduleStore.removeItem,
    setItemAndWait: this.#scheduleStore.setItemAndWait,
    setItem: this.#scheduleStore.setItem,
    subscribe: this.#scheduleStore.subscribe,
    onReady: this.#scheduleStore.onReady,
  };

  get bindings(): Binding[] {
    return this.#bindings;
  }

  get name(): string {
    return this.#name;
  }

  get description(): string {
    return this.#description;
  }

  get namespaces(): string[] {
    return this.#namespaces || [];
  }

  constructor(cfg: CapabilityCfg) {
    this.#name = cfg.name;
    this.#description = cfg.description;
    this.#namespaces = cfg.namespaces;
    this.hasSchedule = false;

    Log.info(`Capability ${this.#name} registered`);
    Log.debug(cfg);
  }

  /**
   * Register the store with the capability. This is called automatically by the Pepr controller.
   */
  registerScheduleStore = (): Storage => {
    Log.info(`Registering schedule store for ${this.#name}`);

    if (this.#scheduleRegistered) {
      throw new Error(`Schedule store already registered for ${this.#name}`);
    }

    this.#scheduleRegistered = true;

    // Pass back any ready callback to the controller
    return this.#scheduleStore;
  };

  /**
   * Register the store with the capability. This is called automatically by the Pepr controller.
   *
   * @param store
   */
  registerStore = (): Storage => {
    Log.info(`Registering store for ${this.#name}`);

    if (this.#registered) {
      throw new Error(`Store already registered for ${this.#name}`);
    }

    this.#registered = true;

    // Pass back any ready callback to the controller
    return this.#store;
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
      model,
      // If the kind is not specified, use the matched kind from the model
      kind: kind || matchedKind,
      event: Event.ANY,
      filters: {
        name: "",
        namespaces: [],
        regexNamespaces: [],
        regexName: "",
        labels: {},
        annotations: {},
        deletionTimestamp: false,
      },
    };

    const bindings = this.#bindings;
    const prefix = `${this.#name}: ${model.name}`;
    const commonChain = { WithLabel, WithAnnotation, WithDeletionTimestamp, Mutate, Validate, Watch, Reconcile, Alias };

    type CommonChainType = typeof commonChain;
    type ExtendedCommonChainType = CommonChainType & {
      Alias: (alias: string) => CommonChainType;
      InNamespace: (...namespaces: string[]) => BindingWithName<T>;
      InNamespaceRegex: (...namespaces: RegExp[]) => BindingWithName<T>;
      WithName: (name: string) => BindingFilter<T>;
      WithNameRegex: (regexName: RegExp) => BindingFilter<T>;
      WithDeletionTimestamp: () => BindingFilter<T>;
    };

    const isNotEmpty = (value: object): boolean => Object.keys(value).length > 0;
    const log = (message: string, cbString: string): void => {
      const filteredObj = pickBy(isNotEmpty, binding.filters);

      Log.info(`${message} configured for ${binding.event}`, prefix);
      Log.info(filteredObj, prefix);
      Log.debug(cbString, prefix);
    };

    function Validate(validateCallback: ValidateAction<T>): ValidateActionChain<T> {
      if (registerAdmission) {
        log("Validate Action", validateCallback.toString());

        // Create the child logger
        const aliasLogger = Log.child({ alias: binding.alias || "no alias provided" });

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isValidate: true,
          validateCallback: async (req, logger = aliasLogger) => {
            Log.info(`Executing validate action with alias: ${binding.alias || "no alias provided"}`);
            return await validateCallback(req, logger);
          },
        });
      }

      return { Watch, Reconcile };
    }

    function Mutate(mutateCallback: MutateAction<T>): MutateActionChain<T> {
      if (registerAdmission) {
        log("Mutate Action", mutateCallback.toString());

        // Create the child logger
        const aliasLogger = Log.child({ alias: binding.alias || "no alias provided" });

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isMutate: true,
          mutateCallback: async (req, logger = aliasLogger) => {
            Log.info(`Executing mutation action with alias: ${binding.alias || "no alias provided"}`);
            await mutateCallback(req, logger);
          },
        });
      }

      // Now only allow adding actions to the same binding
      return { Watch, Validate, Reconcile };
    }

    function Watch(watchCallback: WatchLogAction<T>): FinalizeActionChain<T> {
      if (registerWatch) {
        log("Watch Action", watchCallback.toString());

        // Create the child logger and cast it to the expected type
        const aliasLogger = Log.child({ alias: binding.alias || "no alias provided" }) as typeof Log;

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isWatch: true,
          watchCallback: async (update, phase, logger = aliasLogger) => {
            Log.info(`Executing watch action with alias: ${binding.alias || "no alias provided"}`);
            await watchCallback(update, phase, logger);
          },
        });
      }
      return { Finalize };
    }

    function Reconcile(reconcileCallback: WatchLogAction<T>): FinalizeActionChain<T> {
      if (registerWatch) {
        log("Reconcile Action", reconcileCallback.toString());

        // Create the child logger and cast it to the expected type
        const aliasLogger = Log.child({ alias: binding.alias || "no alias provided" }) as typeof Log;

        // Push the binding to the list of bindings for this capability as a new BindingAction
        // with the callback function to preserve
        bindings.push({
          ...binding,
          isWatch: true,
          isQueue: true,
          watchCallback: async (update, phase, logger = aliasLogger) => {
            Log.info(`Executing reconcile action with alias: ${binding.alias || "no alias provided"}`);
            await reconcileCallback(update, phase, logger);
          },
        });
      }
      return { Finalize };
    }

    function Finalize(finalizeCallback: FinalizeAction<T>): void {
      log("Finalize Action", finalizeCallback.toString());

      // Create the child logger and cast it to the expected type
      const aliasLogger = Log.child({ alias: binding.alias || "no alias provided" }) as typeof Log;

      // Add binding to inject Pepr finalizer during admission (Mutate)
      if (registerAdmission) {
        const mutateBinding = {
          ...binding,
          isMutate: true,
          isFinalize: true,
          event: Event.ANY,
          mutateCallback: addFinalizer,
        };
        bindings.push(mutateBinding);
      }

      // Add binding to process finalizer callback / remove Pepr finalizer (Watch)
      if (registerWatch) {
        const watchBinding = {
          ...binding,
          isWatch: true,
          isFinalize: true,
          event: Event.UPDATE,
          finalizeCallback: async (update: InstanceType<T>, logger = aliasLogger): Promise<boolean | void> => {
            Log.info(`Executing finalize action with alias: ${binding.alias || "no alias provided"}`);
            return await finalizeCallback(update, logger);
          },
        };
        bindings.push(watchBinding);
      }
    }

    function InNamespace(...namespaces: string[]): BindingWithName<T> {
      Log.debug(`Add namespaces filter ${namespaces}`, prefix);
      binding.filters.namespaces.push(...namespaces);
      return { ...commonChain, WithName, WithNameRegex };
    }

    function InNamespaceRegex(...namespaces: RegExp[]): BindingWithName<T> {
      Log.debug(`Add regex namespaces filter ${namespaces}`, prefix);
      binding.filters.regexNamespaces.push(...namespaces.map(regex => regex.source));
      return { ...commonChain, WithName, WithNameRegex };
    }

    function WithDeletionTimestamp(): BindingFilter<T> {
      Log.debug("Add deletionTimestamp filter");
      binding.filters.deletionTimestamp = true;
      return commonChain;
    }

    function WithNameRegex(regexName: RegExp): BindingFilter<T> {
      Log.debug(`Add regex name filter ${regexName}`, prefix);
      binding.filters.regexName = regexName.source;
      return commonChain;
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

    function Alias(alias: string): CommonChainType {
      Log.debug(`Adding prefix alias ${alias}`, prefix);
      binding.alias = alias;
      return commonChain;
    }

    function bindEvent(event: Event): ExtendedCommonChainType {
      binding.event = event;
      return {
        ...commonChain,
        InNamespace,
        InNamespaceRegex,
        WithName,
        WithNameRegex,
        WithDeletionTimestamp,
        Alias,
      };
    }

    return {
      IsCreatedOrUpdated: () => bindEvent(Event.CREATE_OR_UPDATE),
      IsCreated: () => bindEvent(Event.CREATE),
      IsUpdated: () => bindEvent(Event.UPDATE),
      IsDeleted: () => bindEvent(Event.DELETE),
    };
  };
}
