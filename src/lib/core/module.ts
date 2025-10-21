// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { clone } from "ramda";
import { Capability } from "./capability";
import { Controller } from "../controller";
import { ValidateError } from "../errors";
import { CapabilityExport, PackageJSON, PeprModuleOptions, ModuleConfig } from "../types";
import { isBuildMode } from "./envChecks";
import { createControllerHooks } from "../controller/createHooks";

export class PeprModule {
  #controller!: Controller;

  /**
   * Initialize a new Pepr runtime module.
   *
   * @param pkg The package.json data containing Pepr configuration.
   * @param capabilities The list of capabilities to load.
   * @param opts Options for the Pepr runtime settings (e.g., deferStart).
   */

  constructor(
    { description, pepr }: PackageJSON,
    capabilities: Capability[] = [],
    opts: PeprModuleOptions = {},
  ) {
    const config = PeprModule.#initializeConfig(description, pepr);
    PeprModule.#validateConfig(config);

    if (isBuildMode()) {
      PeprModule.#handleBuildMode(capabilities);
      return;
    }

    const controllerHooks = PeprModule.#createHooks(opts, capabilities, pepr, config);
    this.#controller = new Controller(config, capabilities, controllerHooks);

    if (!opts.deferStart) {
      this.start();
    }
  }

  static #initializeConfig(description: string, pepr: PackageJSON["pepr"]): ModuleConfig {
    const config: ModuleConfig = clone(pepr);
    config.description = description;
    return config;
  }

  static #validateConfig(config: ModuleConfig): void {
    ValidateError(config.onError);
  }

  static #handleBuildMode(capabilities: Capability[]): void {
    if (!process.send) {
      throw new Error("process.send is not defined");
    }

    const exportedCapabilities: CapabilityExport[] = capabilities.map(cap => ({
      name: cap.name,
      description: cap.description,
      namespaces: cap.namespaces,
      bindings: cap.bindings,
      hasSchedule: cap.hasSchedule,
    }));

    process.send(exportedCapabilities);
  }

  static #createHooks(
    opts: PeprModuleOptions,
    capabilities: Capability[],
    pepr: PackageJSON["pepr"],
    config: ModuleConfig,
  ): ReturnType<typeof createControllerHooks> {
    const ignored = pepr?.alwaysIgnore?.namespaces?.length
      ? pepr.alwaysIgnore.namespaces
      : config?.watch?.alwaysIgnore?.namespaces;

    return createControllerHooks(opts, capabilities, ignored);
  }
  /**
   * Starts the Pepr runtime manually.
   *
   * Normally this is called automatically when the Pepr module is instantiated,
   * but it can be invoked manually if `deferStart` is set to `true` in the constructor.
   *
   * @param port - The port number to start the server on (default: 3000).
   */
  start = (port = 3000): void => {
    this.#controller.startServer(port);
  };
}
