// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { resolve } from "path";
import { prompt } from "prompts";
import Log from "../../src/lib/logger";
import { helloPeprTS, prettierRC, samplesYaml, snippet, tsConfig } from "./init/templates";
import { write } from "./init/utils";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("update")
    .description("Update this Pepr module")
    .option("--skip-template-update", "Skip updating the template files`")
    .action(async opts => {
      if (!opts.skipTemplateUpdate) {
        const { confirm } = await prompt({
          type: "confirm",
          name: "confirm",
          message:
            "This will overwrite previously auto-generated files inluding the capabilities/HelloPepr.ts file.\n" +
            "Are you sure you want to continue?",
        });

        // If the user doesn't confirm, exit
        if (!confirm) {
          return;
        }
      }

      console.log("Updating the Pepr module...");

      try {
        await write(resolve(prettierRC.path), prettierRC.data);
        await write(resolve(tsConfig.path), tsConfig.data);
        await write(resolve(".vscode", snippet.path), snippet.data);
        await write(resolve("capabilities", samplesYaml.path), samplesYaml.data);
        await write(resolve("capabilities", helloPeprTS.path), helloPeprTS.data);

        // Update Pepr for the module
        execSync("npm install pepr@latest", {
          stdio: "inherit",
        });

        // Update Pepr globally
        execSync("npm install -g pepr@latest", {
          stdio: "inherit",
        });

        console.log(`Module updated!`);
      } catch (e) {
        Log.debug(e);
        if (e instanceof Error) {
          Log.error(e.message);
        }
        process.exit(1);
      }
    });
}
