// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { prompt } from "prompts";
import { Webhook } from "../../src/lib/k8s/webhook";
import Log from "../../src/lib/logger";
import { buildModule } from "./build";
import { RootCmd } from "./root";

/**
 * Deploys a Pepr module.
 * @param program - The root command.
 */
export default function deploy(program: RootCmd): void {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-i, --image [image]", "Override the image tag")
    .option("--confirm", "Skip confirmation prompt")
    .action(async (opts) => {
      if (!opts.confirm) {
        // Prompt the user to confirm
        const { confirm } = await prompt({
          type: "confirm",
          name: "confirm",
          message: "This will remove and redeploy the module. Continue?",
        });

        // Exit if the user doesn't confirm
        if (!confirm) {
          process.exit(0);
        }
      }

      try {
        // Build the module
        const { cfg, path } = await buildModule();

        // Read the compiled module code
        const code = await fs.readFile(path);

        // Generate a secret for the module
        const webhook = new Webhook({
          ...cfg.pepr,
          description: cfg.description,
        });

        // Override the image tag if specified
        if (opts.image) {
          webhook.image = opts.image;
        }

        // Deploy the module
        await webhook.deploy(code);

        Log.info(`Module deployed successfully`);
      } catch (e) {
        Log.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}