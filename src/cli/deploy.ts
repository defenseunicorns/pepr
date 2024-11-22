// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import prompt from "prompts";

import { Assets } from "../lib/assets";
import { buildModule } from "./build";
import { RootCmd } from "./root";
import { validateCapabilityNames } from "../lib/helpers";
import { ImagePullSecret } from "../lib/types";
import { sanitizeName } from "./init/utils";
import { deployImagePullSecret } from "../lib/assets/deploy";
import { namespaceDeploymentsReady } from "../lib/deploymentChecks";

export default function (program: RootCmd) {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-i, --image [image]", "Override the image tag")
    .option("--confirm", "Skip confirmation prompt")
    .option("--pullSecret <name>", "Deploy imagePullSecret for Controller private registry")
    .option("--docker-server <server>", "Docker server address")
    .option("--docker-username <username>", "Docker registry username")
    .option("--docker-email <email>", "Email for Docker registry")
    .option("--docker-password <password>", "Password for Docker registry")
    .option("--force", "Force deploy the module, override manager field")
    .action(async opts => {
      let imagePullSecret: ImagePullSecret | undefined;

      if (
        opts.pullSecret &&
        opts.pullSecret.length > 0 &&
        (!opts.dockerServer || !opts.dockerUsername || !opts.dockerEmail || !opts.dockerPassword)
      ) {
        console.error(
          "Error: Must provide docker server, username, email, and password when providing pull secret",
        );
        process.exit(1);
      } else if (opts.pullSecret && opts.pullSecret !== sanitizeName(opts.pullSecret)) {
        // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
        console.error(
          "Invalid imagePullSecret name. Please provide a valid name as defined in RFC 1123.",
        );
        process.exit(1);
      } else if (opts.pullSecret) {
        imagePullSecret = {
          auths: {
            [opts.dockerServer]: {
              username: opts.dockerUsername,
              password: opts.dockerPassword,
              email: opts.dockerEmail,
              auth: Buffer.from(`${opts.dockerUsername}:${opts.dockerPassword}`).toString("base64"),
            },
          },
        };

        await deployImagePullSecret(imagePullSecret, opts.pullSecret);
        return;
      }

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
      const buildModuleResult = await buildModule();
      if (buildModuleResult?.cfg && buildModuleResult?.path) {
        const { cfg, path } = buildModuleResult;

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
          console.error(`Error deploying module:`, e);
          process.exit(1);
        }
      }
    });
}
