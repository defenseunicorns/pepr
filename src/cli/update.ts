// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { resolve } from "path";
import { prompt } from "prompts";
import Log from "../../src/lib/logger";
import { helloPeprTS, prettierRC, samplesYaml, snippet, tsConfig } from "./init/templates";
import { write } from "./init/utils";
import { RootCmd } from "./root";

/**
 * Updates the Pepr module and its dependencies.
 * @param program The root command object.
 */
export default function updateCommand(program: RootCmd): void {
  program
    .command("update")
    .description("Update this Pepr module")
    .option("--skip-template-update", "Skip updating the template files")
    .action(async (opts) => {
      if (!opts.skipTemplateUpdate) {
        const { confirm } = await prompt({
          type: "confirm",
          name: "confirm",
          message:
            "This will overwrite previously auto-generated files including the capabilities/HelloPepr.ts file.\n" +
            "Are you sure you want to continue?",
        });

        // If the user doesn't confirm, exit
        if (!confirm) {
          return;
        }
      }

      Log.info("Updating the Pepr module...");

      try {
        await Promise.all([
          write(resolve(prettierRC.path), prettierRC.data),
          write(resolve(tsConfig.path), tsConfig.data),
          write(resolve(".vscode", snippet.path), snippet.data),
          write(resolve("capabilities", samplesYaml.path), samplesYaml.data),
          write(resolve("capabilities", helloPeprTS.path), helloPeprTS.data),
        ]);

        // Update Pepr for the module and globally
        execSync("npm install pepr@latest -g", {
          stdio: "inherit",
        });

        Log.success("Module updated!");
      } catch (e) {
        Log.debug(e);
        Log.error(e.message);
        process.exit(1);
      }
    });
}