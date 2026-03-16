// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { fork } from "child_process";

import { CapabilityExport } from "../types";

/**
 * Read the capabilities from the module by running it in build mode
 * @param path
 * @returns
 */
export function loadCapabilities(path: string): Promise<CapabilityExport[]> {
  return new Promise((resolve, reject) => {
    // Fork is needed with the PEPR_MODE env var to ensure the module is loaded in build mode and will send back the capabilities
    const program = fork(path, {
      env: {
        ...process.env,
        LOG_LEVEL: "warn",
        PEPR_MODE: "build",
        NODE_OPTIONS: "--disable-warning=DEP0040",
      },
    });

    let settled = false;

    // Wait for the module to send back the capabilities
    program.on("message", message => {
      if (settled) return;
      settled = true;
      // Cast the message to the ModuleCapabilities type
      const capabilities = message.valueOf() as CapabilityExport[];
      resolve(capabilities);
    });

    program.on("error", error => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    // Use "close" instead of "exit" — "close" fires after all IPC/stdio
    // streams are drained, so any pending process.send() from the child
    // will have been delivered as a "message" event before we reach here.
    // "exit" can fire before the queued IPC message is observed, which
    // would cause intermittent false rejections.
    program.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`Child process exited with ${reason} before sending capabilities`));
    });
  });
}
