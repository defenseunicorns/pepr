// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import prompt from "prompts";

import { Assets } from "../lib/assets";
import { buildModule } from "./build";
import { RootCmd } from "./root";
import { peprDeploymentsReady } from "../lib/deploy-helpers";

export default async function (program: RootCmd) {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-i, --image [image]", "Override the image tag")
    .option("--confirm", "Skip confirmation prompt")
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

      try {
        await webhook.deploy();
        // Wait for the resources to be fully up
        //await peprDeploymentsReady();
        console.info(`✅ Module deployed successfully`);
      } catch (e) {
        console.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
  // Wait for the resources to be fully up
  await peprDeploymentsReady();
}
