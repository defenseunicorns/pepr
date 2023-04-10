// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import R from "ramda";
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
   */
  constructor({ description, pepr }: PackageJSON, capabilities: Capability[] = [], deferStart = false) {
    const config: ModuleConfig = R.mergeDeepWith(R.concat, pepr, alwaysIgnore);
    config.description = description;

    this._controller = new Controller(config, capabilities);

    if (!deferStart) {
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
    this._controller.startServer(port);
  }
}
