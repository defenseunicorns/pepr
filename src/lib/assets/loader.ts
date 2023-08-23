// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { fork } from "child_process";

import { Binding } from "../types";

// We are receiving javascript so the private fields are now public
export interface ModuleCapabilities {
  _name: string;
  _description: string;
  _namespaces: string[];
  _bindings: Binding[];
}

/**
 * Read the capabilities from the module by running it in build mode
 * @param path
 * @returns
 */
export function loadCapabilities(path: string): Promise<ModuleCapabilities[]> {
  return new Promise((resolve, reject) => {
    // Fork is needed with the PEPR_MODE env var to ensure the module is loaded in build mode and will send back the capabilities
    const program = fork(path, {
      env: {
        ...process.env,
        LOG_LEVEL: "warn",
        PEPR_MODE: "build",
      },
    });

    // Wait for the module to send back the capabilities
    program.on("message", message => {
      // Cast the message to the ModuleCapabilities type
      const capabilities = message.valueOf() as ModuleCapabilities[];

      // Iterate through the capabilities and generate the rules
      for (const capability of capabilities) {
        console.info(`Registered Pepr Capability "${capability._name}"`);
      }

      resolve(capabilities);
    });

    program.on("error", error => {
      reject(error);
    });
  });
}
