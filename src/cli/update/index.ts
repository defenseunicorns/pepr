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
import { RootCmd } from "../root";

export default function (program: RootCmd): void {
  program
    .command("update")
    .description("Update this Pepr module. Not recommended for prod as it may change files.")
    .option("--skip-template-update", "Skip updating the template files")
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
        // Check if eslint v8 is a project dependency and warn about future upgrade
        let packageLockContent = "";
        let foundPackageLock = false;

        try {
          // Try to find package-lock.json in the current directory
          if (fs.existsSync("./package-lock.json")) {
            packageLockContent = fs.readFileSync("./package-lock.json", "utf-8");
            foundPackageLock = true;
          }
        } catch {
          // Ignore errors and continue with installation
        }

        // If we found the package-lock.json and could read it, check for eslint v8
        if (foundPackageLock && packageLockContent) {
          // Look for eslint version 8.x.x pattern in the file content
          if (
            packageLockContent.indexOf('"eslint":') >= 0 &&
            packageLockContent.match(/"eslint":\s*"[~^]?8\.[0-9]+\.[0-9]+"/)
          ) {
            console.warn(
              "\nWarning: This Pepr module uses ESLint v8. Pepr will be upgraded to use v9 in a future release.\nSee eslint@9.0.0 release notes for more details: https://eslint.org/blog/2024/04/eslint-v9.0.0-released/",
            );
          }
        }

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
        process.exit(1);
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
      } catch (e) {
        console.error(`Error updating template files:`, e);
        process.exit(1);
      }
    });
}
