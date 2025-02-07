// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { clone } from "ramda";
import { Capability } from "./capability";
import { Controller, ControllerHooks } from "../controller";
import { ValidateError } from "../errors";
import { CapabilityExport } from "../types";
import { setupWatch } from "../processors/watch-processor";
import { Log } from "../../lib";
import { resolveIgnoreNamespaces } from "../assets/webhooks";
import { isBuildMode, isDevMode, isWatchMode } from "./envChecks";
import { PackageJSON, PeprModuleOptions, ModuleConfig } from "../types";

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
          hasSchedule: capability.hasSchedule,
        });
      }

      // Send the capabilities back to the parent process
      process.send(exportedCapabilities);

      return;
    }

    const controllerHooks: ControllerHooks = {
      beforeHook: opts.beforeHook,
      afterHook: opts.afterHook,
      onReady: (): void => {
        // Wait for the controller to be ready before setting up watches
        if (isWatchMode() || isDevMode()) {
          try {
            setupWatch(capabilities, resolveIgnoreNamespaces(pepr?.alwaysIgnore?.namespaces));
          } catch (e) {
            Log.error(e, "Error setting up watch");
            process.exit(1);
          }
        }
      },
    };

    this.#controller = new Controller(config, capabilities, controllerHooks);

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
  start = (port = 3000): void => {
    this.#controller.startServer(port);
  };
}
