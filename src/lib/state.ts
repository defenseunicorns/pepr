// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { GroupVersionKind, Request, Response } from "./k8s";
import logger from "./logger";
import { processor } from "./processor";
import { ModuleConfig } from "./types";

export class State {
  private _state: Capability[] = [];
  private _kinds: GroupVersionKind[] = [];

  get kinds(): GroupVersionKind[] {
    return this._kinds;
  }

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   */
  constructor(private readonly _config: ModuleConfig) {}

  Register = (capability: Capability) => {
    logger.info(`Registering capability ${capability.name}`);

    // Add the kinds to the list of kinds (ignoring duplicates for now)
    this._kinds = capability.bindings.map(({ kind }) => kind);

    // Add the capability to the state
    this._state.push(capability);
  };

  ProcessRequest = (req: Request): Response => {
    return processor(this._config, this._state, req);
  };
}
