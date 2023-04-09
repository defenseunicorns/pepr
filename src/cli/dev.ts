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
    .command("dev")
    .description("Setup a local webhook development environment")
    .option("-d, --dir [directory]", "Pepr module directory", ".")
    .option("-h, --host [host]", "Host to listen on", "host.docker.internal")
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
      }, opts.host);

      // Write the TLS cert and key to disk
      await fs.writeFile("insecure-tls.crt", webhook.tls.pem.crt);
      await fs.writeFile("insecure-tls.key", webhook.tls.pem.key);

      try {
        await webhook.deploy(code);
        logger.info(`Module deployed successfully`);
      } catch (e) {
        logger.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}
