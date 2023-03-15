// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { Config } from "./types";

const defaultConfig: Config = {
  alwaysIgnore: {
    kinds: [],
    namespaces: ["kube-system", "pepr-system"],
    labels: ["pepr.dev=ignore"],
  },
};

export class State {
  private _config: Config;
  private _state: Capability[];

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   */
  constructor(config: Config) {
    // Merge the default config with the provided config
    this._config = config = { ...defaultConfig, ...config };

    // Establish the initial state
    this._state = [];

    this._config.alwaysIgnore.kinds?.forEach((kind) => {
      // this.register({ name: kind, description: "Always ignore" });
    });

    this._config.alwaysIgnore.labels;

    let c = new Capability({ name: "test", description: "test" });
  }

  register(capability: Capability) {
    // Add the capability to the state and return the index
    return this._state.push(capability) - 1;
  }
}
