// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind } from "@k8s";
import { Capability } from "./capability";
import { Config } from "./types";

export class State {
  private _config: Config;
  private _state: Capability[];
  private _kinds: GroupVersionKind[];

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   */
  constructor(config: Config) {
    // Merge the default config with the provided config
    this._config = config;

    // Establish the initial state
    this._state = [];

    this._config.alwaysIgnore.labels;
  }

  Register(capability: Capability) {
    // Add the kinds to the list of kinds (ignoring duplicates for now)
    this._kinds = capability.bindings.map(({ kind }) => kind);

    // Add the capability to the state
    this._state.push(capability);
  }
}
