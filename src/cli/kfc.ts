// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import prompt from "prompts";

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("kfc crd [source] [dest]")
    .description("Generate class to handle CRD")
    .action(async (source, dest) => {
      const { confirm } = await prompt({
        type: "confirm",
        name: "confirm",
        message:
          "This will overwrite previously generated files in the destination folder.\n" +
          "Are you sure you want to continue?",
      });

      // If the user doesn't confirm, exit
      if (!confirm) {
        return;
      }

      console.log("Creating the CRD generated class...");

      try {
        // Create the CRD generated class
        execSync(`npx kfc crd ${source} ${dest}`, {
          stdio: "inherit",
        });

        console.log(`✅ CRD generated class created successfully`);
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
    });
}
