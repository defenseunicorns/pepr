// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import prompt from "prompts";

import { Assets } from "../lib/assets";
import { buildModule } from "./build";
import { RootCmd } from "./root";
import { validateCapabilityNames, namespaceDeploymentsReady } from "../lib/helpers";

export default function (program: RootCmd) {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-i, --image [image]", "Override the image tag")
    .option("--confirm", "Skip confirmation prompt")
    .option("--force", "Force deploy the module, override manager field")
    .action(async opts => {
      if (!opts.confirm) {
        // Prompt the user to confirm
        const confirm = await prompt({
          type: "confirm",
          name: "confirm",
          message: "This will remove and redeploy the module. Continue?",
        });

        // Exit if the user doesn't confirm
        if (!confirm.confirm) {
          process.exit(0);
        }
      }

      // Build the module
      const { cfg, path } = await buildModule();

      // Generate a secret for the module
      const webhook = new Assets(
        {
          ...cfg.pepr,
          description: cfg.description,
        },
        path,
      );

      if (opts.image) {
        webhook.image = opts.image;
      }

      // Identify conf'd webhookTimeout to give to deploy call
      const timeout = cfg.pepr.webhookTimeout ? cfg.pepr.webhookTimeout : 10;

      try {
        await webhook.deploy(opts.force, timeout);
        // wait for capabilities to be loaded and test names
        validateCapabilityNames(webhook.capabilities);
        // Wait for the pepr-system resources to be fully up
        await namespaceDeploymentsReady();
        console.info(`✅ Module deployed successfully`);
      } catch (e) {
        console.error(`Error deploying module: ${e.message}`);
        process.exit(1);
      }
    });
}
