// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass, GroupVersionKind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import { pickBy } from "ramda";
import Log from "../telemetry/logger";
import { isBuildMode, isDevMode, isWatchMode } from "./envChecks";
import { PeprStore, Storage } from "./storage";
import { OnSchedule, Schedule } from "./schedule";
import { Event } from "../enums";
import {
  Binding,
  BindingAll,
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

    Log.debug(`Capability ${this.#name} registered`);
    Log.debug(cfg);
  }

  /**
   * Register the store with the capability. This is called automatically by the Pepr controller.
   */
  registerScheduleStore = (): Storage => {
    Log.debug(`Registering schedule store for ${this.#name}`);

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
    Log.debug(`Registering store for ${this.#name}`);

    if (this.#registered) {
      throw new Error(`Store already registered for ${this.#name}`);
    }

    this.#registered = true;

    // Pass back any ready callback to the controller
    return this.#store;
  };

  private static createAliasLogger(alias?: string): typeof Log {
    return Log.child({ alias: alias || "no alias provided" });
  }

  private static logBinding(
    capabilityPrefix: string,
    label: string,
    binding: Binding,
    fn: (...args: unknown[]) => unknown,
  ): void {
    const isNotEmpty = (value: unknown): boolean =>
      typeof value === "object" && value !== null ? Object.keys(value).length > 0 : true;

    const filteredObj = pickBy(isNotEmpty, binding.filters);
    Log.info({ prefix: capabilityPrefix }, `${label} configured for ${binding.event}`);
    Log.info({ prefix: capabilityPrefix }, JSON.stringify(filteredObj));
    Log.debug({ prefix: capabilityPrefix }, fn.toString());
  }

  private static registerValidate<T extends GenericClass>(
    prefix: string,
    binding: Binding,
    bindings: Binding[],
    validateCallback: ValidateAction<T>,
  ): ValidateActionChain<T> {
    if (!registerAdmission) {
      const noopFinalize: FinalizeActionChain<T> = { Finalize: () => undefined };
      return {
        Watch: () => noopFinalize,
        Reconcile: () => noopFinalize,
      };
    }

    Capability.logBinding(
      prefix,
      "Validate Action",
      binding,
      validateCallback as unknown as (...args: unknown[]) => unknown,
    );
    const aliasLogger = Capability.createAliasLogger(binding.alias);

    bindings.push({
      ...binding,
      isValidate: true,
      validateCallback: async (req, logger = aliasLogger) => {
        if (binding.alias) Log.info(`Executing validate action with alias: ${binding.alias}`);
        return await validateCallback(req, logger);
      },
    });

    return {
      Watch: Capability.registerWatch.bind(Capability, prefix, binding, bindings),
      Reconcile: Capability.registerReconcile.bind(Capability, prefix, binding, bindings),
    };
  }

  private static registerMutate<T extends GenericClass>(
    prefix: string,
    binding: Binding,
    bindings: Binding[],
    mutateCallback: MutateAction<T>,
  ): MutateActionChain<T> {
    if (!registerAdmission) {
      const noopFinalize: FinalizeActionChain<T> = { Finalize: () => undefined };
      const noopValidate: ValidateActionChain<T> = {
        Watch: () => noopFinalize,
        Reconcile: () => noopFinalize,
      };
      return {
        Watch: () => noopFinalize,
        Validate: () => noopValidate,
        Reconcile: () => noopFinalize,
      };
    }

    Capability.logBinding(
      prefix,
      "Mutate Action",
      binding,
      mutateCallback as unknown as (...args: unknown[]) => unknown,
    );
    const aliasLogger = Capability.createAliasLogger(binding.alias);

    bindings.push({
      ...binding,
      isMutate: true,
      mutateCallback: async (req, logger = aliasLogger) => {
        if (binding.alias) Log.info(`Executing mutation action with alias: ${binding.alias}`);
        await mutateCallback(req, logger);
      },
    });

    return {
      Watch: Capability.registerWatch.bind(Capability, prefix, binding, bindings),
      Validate: Capability.registerValidate.bind(Capability, prefix, binding, bindings),
      Reconcile: Capability.registerReconcile.bind(Capability, prefix, binding, bindings),
    };
  }

  private static registerWatch<T extends GenericClass>(
    prefix: string,
    binding: Binding,
    bindings: Binding[],
    watchCallback: WatchLogAction<T>,
  ): FinalizeActionChain<T> {
    if (!registerWatch) return { Finalize: () => undefined };

    Capability.logBinding(
      prefix,
      "Watch Action",
      binding,
      watchCallback as unknown as (...args: unknown[]) => unknown,
    );
    const aliasLogger = Capability.createAliasLogger(binding.alias);

    bindings.push({
      ...binding,
      isWatch: true,
      watchCallback: async (update, phase, logger = aliasLogger) => {
        if (binding.alias) Log.info(`Executing watch action with alias: ${binding.alias}`);
        await watchCallback(update, phase, logger);
      },
    });

    return { Finalize: Capability.registerFinalize.bind(Capability, prefix, binding, bindings) };
  }

  private static registerReconcile<T extends GenericClass>(
    prefix: string,
    binding: Binding,
    bindings: Binding[],
    reconcileCallback: WatchLogAction<T>,
  ): FinalizeActionChain<T> {
    if (!registerWatch) return { Finalize: () => undefined };

    Capability.logBinding(
      prefix,
      "Reconcile Action",
      binding,
      reconcileCallback as unknown as (...args: unknown[]) => unknown,
    );
    const aliasLogger = Capability.createAliasLogger(binding.alias);

    bindings.push({
      ...binding,
      isWatch: true,
      isQueue: true,
      watchCallback: async (update, phase, logger = aliasLogger) => {
        if (binding.alias) Log.info(`Executing reconcile action with alias: ${binding.alias}`);
        await reconcileCallback(update, phase, logger);
      },
    });

    return { Finalize: Capability.registerFinalize.bind(Capability, prefix, binding, bindings) };
  }

  private static registerFinalize<T extends GenericClass>(
    prefix: string,
    binding: Binding,
    bindings: Binding[],
    finalizeCallback: FinalizeAction<T>,
  ): void {
    Capability.logBinding(
      prefix,
      "Finalize Action",
      binding,
      finalizeCallback as unknown as (...args: unknown[]) => unknown,
    );
    const aliasLogger = Capability.createAliasLogger(binding.alias);

    if (registerAdmission) {
      bindings.push({
        ...binding,
        isMutate: true,
        isFinalize: true,
        event: Event.ANY,
        mutateCallback: addFinalizer,
      });
    }

    if (registerWatch) {
      bindings.push({
        ...binding,
        isWatch: true,
        isFinalize: true,
        event: Event.UPDATE,
        finalizeCallback: async (update, logger = aliasLogger): Promise<boolean | void> => {
          if (binding.alias) Log.info(`Executing finalize action with alias: ${binding.alias}`);
          return await finalizeCallback(update, logger);
        },
      });
    }
  }

  /**
   * Registers actions to execute when Kubernetes resources of a given kind are processed by Pepr.
   *
   * The action is triggered when the resource matches the provided kind and any applied filters.
   *
   * @param model The Kubernetes resource model to watch (e.g., a.Deployment).
   * @param kind  Optional GroupVersionKind for custom resources.
   * @returns A chainable API for defining filters and actions.
   */
  When = <T extends GenericClass>(model: T, kind?: GroupVersionKind): WhenSelector<T> => {
    const matchedKind = modelToGroupVersionKind(model.name);

    // If the kind is not specified and the model is not a KubernetesObject, throw an error
    if (!matchedKind && !kind) throw new Error(`Kind not specified for ${model.name}`);

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

    type FilterChain = {
      WithLabel: (key: string, value?: string) => FilterChain;
      WithAnnotation: (key: string, value?: string) => FilterChain;
      WithDeletionTimestamp: () => FilterChain;
      Mutate: (action: MutateAction<T, InstanceType<T>>) => MutateActionChain<T>;
      Alias: (alias: string) => FilterChain;
      Validate: (action: ValidateAction<T, InstanceType<T>>) => ValidateActionChain<T>;
      Watch: (action: WatchLogAction<T, InstanceType<T>>) => FinalizeActionChain<T>;
      Reconcile: (action: WatchLogAction<T, InstanceType<T>>) => FinalizeActionChain<T>;
    };

    type WithNameChain = FilterChain & {
      WithName: (name: string) => FilterChain;
      WithNameRegex: (regexName: RegExp) => FilterChain;
    };

    const filterChain: FilterChain = {
      WithLabel: (key: string, value = "") => {
        Log.debug({ prefix }, `Add label filter ${key}=${value}`);
        binding.filters.labels[key] = value;
        return filterChain;
      },
      WithAnnotation: (key: string, value = "") => {
        Log.debug({ prefix }, `Add annotation filter ${key}=${value}`);
        binding.filters.annotations[key] = value;
        return filterChain;
      },
      WithDeletionTimestamp: () => {
        Log.debug({ prefix }, "Add deletionTimestamp filter");
        binding.filters.deletionTimestamp = true;
        return filterChain;
      },

      Mutate: (action: MutateAction<T, InstanceType<T>>) =>
        Capability.registerMutate<T>(prefix, binding, bindings, action),
      Validate: (action: ValidateAction<T, InstanceType<T>>) =>
        Capability.registerValidate<T>(prefix, binding, bindings, action),
      Watch: (action: WatchLogAction<T, InstanceType<T>>) =>
        Capability.registerWatch<T>(prefix, binding, bindings, action),
      Reconcile: (action: WatchLogAction<T, InstanceType<T>>) =>
        Capability.registerReconcile<T>(prefix, binding, bindings, action),
      Alias: (alias: string) => {
        Log.debug({ prefix }, `Adding prefix alias ${alias}`);
        binding.alias = alias;
        return filterChain;
      },
    };

    const withNameChain: WithNameChain = {
      ...filterChain,
      WithName: (name: string) => {
        Log.debug({ prefix }, `Add name filter ${name}`);
        binding.filters.name = name;
        return filterChain;
      },
      WithNameRegex: (regexName: RegExp) => {
        Log.debug({ prefix }, `Add regex name filter ${regexName}`);
        binding.filters.regexName = regexName.source;
        return filterChain;
      },
    };

    const bindEvent = (event: Event): BindingAll<T> => {
      binding.event = event;

      return {
        WithName: withNameChain.WithName,
        WithNameRegex: withNameChain.WithNameRegex,
        InNamespace: (...namespaces: string[]): WithNameChain => {
          Log.debug({ prefix }, `Add namespaces filter ${namespaces}`);
          binding.filters.namespaces.push(...namespaces);
          return withNameChain;
        },
        InNamespaceRegex: (...namespaces: RegExp[]): WithNameChain => {
          Log.debug({ prefix }, `Add regex namespaces filter ${namespaces}`);
          binding.filters.regexNamespaces.push(...namespaces.map(r => r.source));
          return withNameChain;
        },
        WithLabel: filterChain.WithLabel,
        WithAnnotation: filterChain.WithAnnotation,
        WithDeletionTimestamp: filterChain.WithDeletionTimestamp,
        Mutate: filterChain.Mutate,
        Validate: filterChain.Validate,
        Watch: filterChain.Watch,
        Reconcile: filterChain.Reconcile,
        Alias: filterChain.Alias,
      };
    };

    return {
      IsCreatedOrUpdated: () => bindEvent(Event.CREATE_OR_UPDATE),
      IsCreated: () => bindEvent(Event.CREATE),
      IsUpdated: () => bindEvent(Event.UPDATE),
      IsDeleted: () => bindEvent(Event.DELETE),
    };
  };
}
