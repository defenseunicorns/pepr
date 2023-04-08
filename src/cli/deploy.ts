// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { Webhook } from "../lib/k8s/webhook";
import logger from "../lib/logger";
import { buildModule } from "./build";
import { RootCmd } from "./root";
import { prompt } from "prompts";

export default function (program: RootCmd) {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-d, --dir [directory]", "Pepr module directory", ".")
    .action(async opts => {
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

      // Build the module
      const { cfg, path } = await buildModule(opts.dir);

      // Read the compiled module code
      const code = await fs.readFile(path, { encoding: "utf-8" });

      // Generate a secret for the module
      const webhook = new Webhook({
        ...cfg.pepr,
        description: cfg.description,
      });

      try {
        await webhook.deploy(code);
        logger.info(`Module deployed successfully`);
      } catch (e) {
        logger.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}
