// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import prompt from "prompts";
import { Assets } from "../lib/assets/assets";
import { ChildProcess, fork } from "child_process";
import { K8s, kind } from "kubernetes-fluent-client";
import { RootCmd } from "./root";
import { Store } from "../lib/k8s";
import { buildModule, loadModule } from "./build";
import { deployWebhook } from "../lib/assets/deploy";
import { promises as fs } from "fs";
import { validateCapabilityNames } from "../lib/helpers";

export default function (program: RootCmd): void {
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
      const webhook = new Assets(
        {
          ...cfg.pepr,
          description: cfg.description,
        },
        path,
        [],
        opts.host,
      );

      // Write the TLS cert and key to disk
      await fs.writeFile("insecure-tls.crt", webhook.tls.pem.crt);
      await fs.writeFile("insecure-tls.key", webhook.tls.pem.key);

      try {
        let program: ChildProcess;
        const name = `pepr-${cfg.pepr.uuid}`;
        const scheduleStore = `pepr-${cfg.pepr.uuid}-schedule`;
        const store = `pepr-${cfg.pepr.uuid}-store`;

        // Run the processed javascript file
        const runFork = async (): Promise<void> => {
          console.info(`Running module ${path}`);

          // Deploy the webhook with a 30 second timeout for debugging, don't force
          await webhook.deploy(deployWebhook, false, 30);

          try {
            // wait for capabilities to be loaded and test names
            validateCapabilityNames(webhook.capabilities);
          } catch (e) {
            console.error(`Error validating capability names:`, e);
            process.exit(1);
          }

          program = fork(path, {
            env: {
              ...process.env,
              LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
              PEPR_MODE: "dev",
              PEPR_API_PATH: webhook.apiPath,
              PEPR_PRETTY_LOGS: "true",
              SSL_KEY_PATH: "insecure-tls.key",
              SSL_CERT_PATH: "insecure-tls.crt",
            },
            stdio: "inherit",
          });

          program.on("close", async () => {
            await Promise.all([
              K8s(kind.MutatingWebhookConfiguration).Delete(name),
              K8s(kind.ValidatingWebhookConfiguration).Delete(name),
              K8s(Store).InNamespace("pepr-system").Delete(scheduleStore),
              K8s(Store).InNamespace("pepr-system").Delete(store),
            ]);
          });

          // listen for CTRL+C and remove webhooks
          process.on("SIGINT", () => {
            console.debug(`Received SIGINT, removing webhooks`);
          });
        };

        await buildModule(async r => {
          if (r.errors.length > 0) {
            console.error(`Error compiling module: ${r.errors}`);
            return;
          }

          if (program) {
            program.once("exit", runFork);
            program.kill("SIGKILL");
          } else {
            await runFork();
          }
        });
      } catch (e) {
        console.error(`Error deploying module:`, e);
        process.exit(1);
      }
    });
}
