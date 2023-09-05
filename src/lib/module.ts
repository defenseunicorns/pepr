// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";

import { Capability } from "./capability";
import { Controller } from "./controller";
import { ValidateError } from "./errors";
import { MutateResponse, Request, ValidateResponse } from "./k8s/types";
import { CapabilityExport, ModuleConfig } from "./types";

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

    // Bind public methods
    this.start = this.start.bind(this);

    // Handle build mode
    if (process.env.PEPR_MODE === "build" && process.send) {
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

      process.send(exportedCapabilities);

      return;
    }

    this.#controller = new Controller(config, capabilities, opts.beforeHook, opts.afterHook);

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
  start(port = 3000) {
    this.#controller.startServer(port);
  }
}
