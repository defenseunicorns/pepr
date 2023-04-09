// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { Webhook } from "../lib/k8s/webhook";
import Log from "../lib/logger";
import { buildModule } from "./build";
import { RootCmd } from "./root";
import { prompt } from "prompts";

export default function (program: RootCmd) {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-d, --dir [directory]", "Pepr module directory", ".")
    .option("-i, --image [image]", "Override the image tag")
    .option("-f, --force", "Force redeployment")
    .action(async opts => {
      if (!opts.force) {
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
      const { cfg, path } = await buildModule(opts.dir);

      // Read the compiled module code
      const code = await fs.readFile(path, { encoding: "utf-8" });

      // Generate a secret for the module
      const webhook = new Webhook({
        ...cfg.pepr,
        description: cfg.description,
      });

      if (opts.image) {
        webhook.image = opts.image;
      }

      try {
        await webhook.deploy(code);
        Log.info(`Module deployed successfully`);
      } catch (e) {
        Log.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}
