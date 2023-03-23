// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GroupVersionKind, Request } from "@k8s";
import { Capability } from "./capability";
import { RequestWrapper } from "./request";
import { ModuleConfig } from "./types";

export class State {
  private _config: ModuleConfig;
  private _state: Capability[];
  private _kinds: GroupVersionKind[];

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   */
  constructor(config: ModuleConfig) {
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

  ProcessRequest(req: Request) {
    const wrapped = new RequestWrapper(req);

    this._state.forEach((capability) => {
      capability.bindings.forEach((binding) => {
        // todo: handle bindings and filters
        binding.callback(wrapped);
      });
    });
  }
}
