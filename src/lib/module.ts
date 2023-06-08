// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { concat, mergeDeepWith } from "ramda";

import { Capability } from "./capability";
import { Controller } from "./controller";
import { Request, Response } from "./k8s/types";
import { ModuleConfig } from "./types";

const alwaysIgnore = {
  namespaces: ["kube-system", "pepr-system"],
  labels: [{ "pepr.dev": "ignore" }],
};

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

export type PeprModuleOptions = {
  deferStart?: boolean;

  /** A user-defined callback to pre-process or intercept a Pepr request from K8s immediately before it is processed */
  beforeHook?: (req: Request) => void;

  /** A user-defined callback to post-process or intercept a Pepr response just before it is returned to K8s */
  afterHook?: (res: Response) => void;
};

export class PeprModule {
  private _controller!: Controller;

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   * @param capabilities The capabilities to be loaded into the Pepr runtime
   * @param _deferStart (optional) If set to `true`, the Pepr runtime will not be started automatically. This can be used to start the Pepr runtime manually with `start()`.
   */
  constructor({ description, pepr }: PackageJSON, capabilities: Capability[] = [], opts: PeprModuleOptions = {}) {
    const config: ModuleConfig = mergeDeepWith(concat, pepr, alwaysIgnore);
    config.description = description;

    // Handle build mode
    if (process.env.PEPR_MODE === "build") {
      process.send?.({ capabilities });
      return;
    }

    this._controller = new Controller(config, capabilities, opts.beforeHook, opts.afterHook);

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
    this._controller.startServer(port);
  }
}
