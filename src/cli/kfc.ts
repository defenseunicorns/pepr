// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import prompt from "prompts";

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("kfc [args...]")
    .description("Execute Kubernetes Fluent Client commands")
    .action(async (args: string[]) => {
      const { confirm } = await prompt({
        type: "confirm",
        name: "confirm",
        message:
          "For commands that generate files, this may overwrite any previously generated files.\n" +
          "Are you sure you want to continue?",
      });

      // If the user doesn't confirm, exit
      if (!confirm) {
        return;
      }

      try {
        // If the user doesn't provide any kfc arguments, show the kfc help
        if (args.length === 0) {
          args.push("--help");
        }

        // Join the args array into a space-separated string
        const argsString = args.join(" ");

        // Create the CRD generated class
        execSync(`kubernetes-fluent-client ${argsString}`, {
          stdio: "inherit",
        });
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
    });
}
