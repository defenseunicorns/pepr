// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { shouldSkipRequest as shouldSkipAction } from "./filter";
import { GroupVersionKind, Request } from "./k8s";
import logger from "./logger";
import { RequestWrapper } from "./request";
import { ModuleConfig } from "./types";

export class State {
  private _config: ModuleConfig;
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
  constructor(config: ModuleConfig) {
    // Merge the default config with the provided config
    this._config = config;
  }

  Register = (capability: Capability) => {
    logger.info(`Registering capability ${capability.name}`);

    // Add the kinds to the list of kinds (ignoring duplicates for now)
    this._kinds = capability.bindings.map(({ kind }) => kind);

    // Add the capability to the state
    this._state.push(capability);
  };

  ProcessRequest = (req: Request) => {
    const wrapped = new RequestWrapper(req);

    logger.info(`Processing '${req.uid}' for '${req.kind}' '${req.name}'`);

    this._state.forEach(capability => {
      const prefix = `${req.uid} ${req.name}: ${capability.name}`;
      logger.info(`Processing capability ${capability.name}`, prefix);

      capability.bindings.forEach(action => {
        if (shouldSkipAction(action, req)) {
          return;
        }

        logger.info(`Processing matched action ${action.kind.kind}`, prefix);

        try {
          action.callback(wrapped);
        } catch (e) {
          logger.error(`Error processing action ${action.kind.kind}: ${e}`, prefix);
          logger.debug(e);
        }
      });
    });
  };
}
