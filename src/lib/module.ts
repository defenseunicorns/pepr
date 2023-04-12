// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { utils } from "index";
import { Capability } from "./capability";
import { Controller } from "./controller";
import { ModuleConfig } from "./types";

const alwaysIgnore = {
  namespaces: ["kube-system", "pepr-system"],
  labels: [{ "pepr.dev": "ignore" }],
};

export type PackageJSON = {
  description: string;
  pepr: ModuleConfig;
};

export class PeprModule {
  private _controller: Controller;

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   * @param capabilities The capabilities to be loaded into the Pepr runtime
   * @param _deferStart (optional) If set to `true`, the Pepr runtime will not be started automatically. This can be used to start the Pepr runtime manually with `start()`.
   */
  constructor(
    { description, pepr }: PackageJSON,
    capabilities: Capability[] = [],
    private readonly _deferStart = false
  ) {
    const config: ModuleConfig = utils.mergeDeepWith(utils.concat, pepr, alwaysIgnore);
    config.description = description;

    this._controller = new Controller(config, capabilities);

    if (!_deferStart) {
      this.start();
    }
  }

  /**
   * Start the Pepr runtime manually.
   * Normally this is called automatically when the Pepr module is instantiated, but can be called manually if `deferStart` is set to `true` in the constructor.
   *
   * @param port
   */
  start(port = 3000) {
    if (!this._deferStart) {
      throw new Error("Cannot start Pepr module: Pepr module was not instantiated with deferStart=true");
    }

    this._controller.startServer(port);
  }
}
