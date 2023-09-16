// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";

import { Capability } from "./capability";
import { Controller } from "./controller";
import { ValidateError } from "./errors";
import { isBuildMode, isDevMode, isWatchMode } from "./k8s";
import { MutateResponse, Request, ValidateResponse } from "./k8s/types";
import { CapabilityExport, ModuleConfig } from "./types";
import { ParallelWatch } from "./k8s/watch";

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

export type PeprModuleOptions = {
  deferStart?: boolean;

  /** A user-defined callback to pre-process or intercept a Pepr request from K8s immediately before it is processed */
  beforeHook?: (req: Request) => void;

  /** A user-defined callback to post-process or intercept a Pepr response just before it is returned to K8s */
  afterHook?: (res: MutateResponse | ValidateResponse) => void;
};

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
        ParallelWatch(binding.model, binding.filters).subscribe(binding.watchCallback!);
      });
  }
}
