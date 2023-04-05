// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { GroupVersionKind, Request, Response } from "./k8s";
import logger from "./logger";
import { processor } from "./processor";
import { ModuleAdditionalCfg, ModuleConfig } from "./types";

export type PackageJSON = {
  description: string;
  pepr: {
    uuid: string;
    name: string;
    version: string;
    onError: string;
  };
};

export class PeprModule {
  private _config: ModuleConfig;
  private _state: Capability[] = [];
  private _kinds: GroupVersionKind[] = [];

  get kinds(): GroupVersionKind[] {
    return this._kinds;
  }

  get UUID(): string {
    return this._config.uuid;
  }

  /**
   * Create a new Pepr runtime
   *
   * @param config The configuration for the Pepr runtime
   */
  constructor({ description, pepr }: PackageJSON, additionalCfg: ModuleAdditionalCfg) {
    this._config = {
      // Hardcode default values
      alwaysIgnore: {
        namespaces: ["kube-system", "pepr-system"],
        labels: [{ "pepr.dev": "ignore" }],
      },
      ...pepr,
      ...additionalCfg,
      description,
    } as ModuleConfig;
  }

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
