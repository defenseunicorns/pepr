// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import fs from "fs";
import { resolve } from "path";
import prompt from "prompts";

import {
  codeSettings,
  helloPepr,
  prettier,
  samplesYaml,
  snippet,
  tsConfig,
} from "../init/templates";
import { write } from "../init/utils";
import { Command } from "commander";

export default function (program: Command): void {
  program
    .command("update")
    .description("Update this Pepr module. Not recommended for prod as it may change files.")
    .option("-s, --skip-template-update", "Do not update template files")
    .action(async opts => {
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

      console.log("Updating the Pepr module...");

      try {
        // Update Pepr for the module
        execSync("npm install pepr@latest", {
          stdio: "inherit",
        });

        // Don't update the template files if the user specified the --skip-template-update flag
        if (!opts.skipTemplateUpdate) {
          execSync("npx pepr update-templates", {
            stdio: "inherit",
          });
        }

        console.log(`✅ Module updated successfully`);
      } catch (e) {
        console.error(`Error updating Pepr module:`, e);
        process.exitCode = 1;
      }
    });

  program
    .command("update-templates", { hidden: true })
    .description("Perform template updates")
    .action(async opts => {
      console.log("Updating Pepr config and template tiles...");

      try {
        // Don't update the template files if the user specified the --skip-template-update flag
        if (!opts.skipTemplateUpdate) {
          await write(resolve(prettier.path), prettier.data);
          await write(resolve(tsConfig.path), tsConfig.data);
          await write(resolve(".vscode", snippet.path), snippet.data);
          await write(resolve(".vscode", codeSettings.path), codeSettings.data);

          // Update the samples.yaml file if it exists
          const samplePath = resolve("capabilities", samplesYaml.path);
          if (fs.existsSync(samplePath)) {
            fs.unlinkSync(samplePath);
            await write(samplePath, samplesYaml.data);
          }

          // Update the HelloPepr.ts file if it exists
          const tsPath = resolve("capabilities", helloPepr.path);
          if (fs.existsSync(tsPath)) {
            await write(tsPath, helloPepr.data);
          }
        }
        throw new Error("another error, for testing");
      } catch (e) {
        console.error(`Error updating template files:`, e);
        process.exitCode = 1;
      }
    });
}
