// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s } from "kubernetes-fluent-client";
import { clone } from "ramda";

import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { Capability } from "./capability";
import { Controller } from "./controller";
import { ValidateError } from "./errors";
import { AdmissionRequest, MutateResponse, ValidateResponse, WebhookIgnore } from "./k8s";
import Log from "./logger";
import { CapabilityExport, Event } from "./types";

/** Global configuration for the Pepr runtime. */
export type ModuleConfig = {
  /** The user-defined name for the module */
  name: string;
  /** The Pepr version this module uses */
  peprVersion?: string;
  /** The user-defined version of the module */
  appVersion?: string;
  /** A unique identifier for this Pepr module. This is automatically generated by Pepr. */
  uuid: string;
  /** A description of the Pepr module and what it does. */
  description?: string;
  /** Reject K8s resource AdmissionRequests on error. */
  onError?: string;
  /** Configure global exclusions that will never be processed by Pepr. */
  alwaysIgnore: WebhookIgnore;
  /** Define the log level for the in-cluster controllers */
  logLevel?: string;
};

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

export type PeprModuleOptions = {
  deferStart?: boolean;

  /** A user-defined callback to pre-process or intercept a Pepr request from K8s immediately before it is processed */
  beforeHook?: (req: AdmissionRequest) => void;

  /** A user-defined callback to post-process or intercept a Pepr response just before it is returned to K8s */
  afterHook?: (res: MutateResponse | ValidateResponse) => void;
};

// Track if this is a watch mode controller
export const isWatchMode = () => process.env.PEPR_WATCH_MODE === "true";

// Track if Pepr is running in build mode
export const isBuildMode = () => process.env.PEPR_MODE === "build";

export const isDevMode = () => process.env.PEPR_MODE === "dev";

export class PeprModule {
  #controller!: Controller;

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   * @param capabilities The capabilities to be loaded into the Pepr runtime
   * @param opts Options for the Pepr runtime
   */
  constructor({ description, pepr }: PackageJSON, capabilities: Capability[] = [], opts: PeprModuleOptions = {}) {
    const config: ModuleConfig = clone(pepr);
    config.description = description;

    // Need to validate at runtime since TS gets sad about parsing the package.json
    ValidateError(config.onError);

    // Handle build mode
    if (isBuildMode()) {
      // Fail if process.send is not defined
      if (!process.send) {
        throw new Error("process.send is not defined");
      }

      const exportedCapabilities: CapabilityExport[] = [];

      // Send capability map to parent process
      for (const capability of capabilities) {
        // Convert the capability to a capability config
        exportedCapabilities.push({
          name: capability.name,
          description: capability.description,
          namespaces: capability.namespaces,
          bindings: capability.bindings,
        });
      }

      // Send the capabilities back to the parent process
      process.send(exportedCapabilities);

      return;
    }

    this.#controller = new Controller(config, capabilities, opts.beforeHook, opts.afterHook);

    // Setup watch mode if enabled
    if (isWatchMode() || isDevMode()) {
      PeprModule.setupWatch(capabilities);
    }

    // Stop processing if deferStart is set to true
    if (opts.deferStart) {
      return;
    }

    this.start();
  }

  /**
   * Start the Pepr runtime manually.
   * Normally this is called automatically when the Pepr module is instantiated, but can be called manually if `deferStart` is set to `true` in the constructor.
   *
   * @param port
   */
  start = (port = 3000) => {
    this.#controller.startServer(port);
  };

  static setupWatch(capabilities: Capability[]) {
    capabilities
      .flatMap(c => c.bindings)
      .filter(binding => binding.isWatch)
      .forEach(binding => {
        // Map the event to the watch phase
        const eventToPhaseMap = {
          [Event.Create]: [WatchPhase.Added],
          [Event.Update]: [WatchPhase.Modified],
          [Event.CreateOrUpdate]: [WatchPhase.Added, WatchPhase.Modified],
          [Event.Delete]: [WatchPhase.Deleted],
          [Event.Any]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
        };

        // Get the phases to match, default to any
        const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.Any];

        // Watch the resource
        void K8s(binding.model, binding.filters).Watch((obj, type) => {
          // If the type matches the phase, call the watch callback
          if (phaseMatch.includes(type)) {
            try {
              // This may be a promise, but we don't need to wait for it
              void binding.watchCallback?.(obj, type);
            } catch (e) {
              // Errors in the watch callback should not crash the controller
              Log.error(e, "Error executing watch callback");
            }
          }
        });
      });
  }
}
