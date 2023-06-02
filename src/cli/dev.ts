// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ChildProcess, fork } from "child_process";
import { promises as fs } from "fs";
import prompt from "prompts";

import { Webhook } from "../lib/k8s/webhook";
import Log from "../lib/logger";
import { buildModule, loadModule } from "./build";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("dev")
    .description("Setup a local webhook development environment")
    .option("-h, --host [host]", "Host to listen on", "host.k3d.internal")
    .option("--confirm", "Skip confirmation prompt")
    .action(async opts => {
      // Prompt the user to confirm if they didn't pass the --confirm flag
      if (!opts.confirm) {
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
      const { cfg, path } = await loadModule();

      // Generate a secret for the module
      const webhook = new Webhook(
        {
          ...cfg.pepr,
          description: cfg.description,
        },
        opts.host
      );

      // Write the TLS cert and key to disk
      await fs.writeFile("insecure-tls.crt", webhook.tls.pem.crt);
      await fs.writeFile("insecure-tls.key", webhook.tls.pem.key);

      try {
        // Deploy the webhook with a 30 second timeout for debugging
        await webhook.deploy(undefined, 30);
        Log.info(`Module deployed successfully`);

        let program: ChildProcess;

        // Run the processed javascript file
        const runFork = () => {
          Log.info(`Running module ${path}`);

          program = fork(path, {
            env: {
              ...process.env,
              LOG_LEVEL: "debug",
              SSL_KEY_PATH: "insecure-tls.key",
              SSL_CERT_PATH: "insecure-tls.crt",
            },
          });
        };

        await buildModule(r => {
          if (r.errors.length > 0) {
            Log.error(`Error compiling module: ${r.errors}`);
            return;
          }

          if (program) {
            program.once("exit", runFork);
            program.kill();
          } else {
            runFork();
          }
        });
      } catch (e) {
        Log.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}
