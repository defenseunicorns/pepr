// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import prompt from "prompts";
import { CapabilityExport } from "../lib/types";
import { Assets } from "../lib/assets/assets";
import { ImagePullSecret } from "../lib/types";
import { RootCmd } from "./root";
import { buildModule } from "./build";
import { deployImagePullSecret, deployWebhook } from "../lib/assets/deploy";
import { namespaceDeploymentsReady } from "../lib/deploymentChecks";
import { sanitizeName } from "./init/utils";
import { validateCapabilityNames } from "../lib/helpers";
import { namespaceComplianceValidator } from "../lib/helpers";
import { loadCapabilities } from "../lib/assets/loader";
export interface ImagePullSecretDetails {
  pullSecret?: string;
  dockerServer?: string;
  dockerUsername?: string;
  dockerEmail?: string;
  dockerPassword?: string;
}

export function validateImagePullSecretDetails(details: ImagePullSecretDetails): {
  valid: boolean;
  error?: string;
} {
  if (!details.pullSecret) {
    return { valid: true };
  }

  // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
  if (details.pullSecret !== sanitizeName(details.pullSecret)) {
    return {
      valid: false,
      error: `Invalid --pullSecret. Must be valid name as defined in RFC 1123.`,
    };
  }

  const missing: string[] = [];
  if (!details.dockerEmail) {
    missing.push("--docker-email");
  }
  if (!details.dockerServer) {
    missing.push("--docker-server");
  }
  if (!details.dockerUsername) {
    missing.push("--docker-username");
  }
  if (!details.dockerPassword) {
    missing.push("--docker-password");
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Error: Must provide ${missing.join(", ")} when providing --pullSecret`,
    };
  }

  return { valid: true };
}

export type ValidatedImagePullSecretDetails = Required<ImagePullSecretDetails>;

function generateImagePullSecret(details: ValidatedImagePullSecretDetails): ImagePullSecret {
  const auth = Buffer.from(`${details.dockerUsername}:${details.dockerPassword}`).toString(
    "base64",
  );
  return {
    auths: {
      [details.dockerServer]: {
        username: details.dockerUsername,
        password: details.dockerPassword,
        email: details.dockerEmail,
        auth,
      },
    },
  };
}

export async function getUserConfirmation(opts: { yes: boolean }): Promise<boolean> {
  if (opts.yes) {
    return true;
  }

  // Prompt the user to confirm
  const confirmation = await prompt({
    type: "confirm",
    name: "yes",
    message: "This will remove and redeploy the module. Continue?",
  });

  return confirmation.yes ? true : false;
}

async function buildAndDeployModule(image: string, force: boolean): Promise<void> {
  const builtModule = await buildModule();
  if (!builtModule) {
    return;
  }

  // Generate a secret for the module
  const webhook = new Assets(
    { ...builtModule.cfg.pepr, description: builtModule.cfg.description },
    builtModule.path,
    [],
  );
  webhook.image = image ?? webhook.image;
  const capabilities = await loadCapabilities(webhook.path);
  for (const capability of capabilities) {
    validateNamespaces(capability, webhook);
  }
  try {
    await webhook.deploy(deployWebhook, force, builtModule.cfg.pepr.webhookTimeout ?? 10);

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

export default function (program: RootCmd): void {
  program
    .command("deploy")
    .description("Deploy a Pepr Module")
    .option("-E, --docker-email <email>", "Email for Docker registry.")
    .option("-P, --docker-password <password>", "Password for Docker registry.")
    .option("-S, --docker-server <server>", "Docker server address.")
    .option("-U, --docker-username <username>", "Docker registry username.")
    .option("-f, --force", "Force deploy the module, override manager field.")
    .option("-i, --image <image>", "Override the image tag.")
    .option("-p, --pull-secret <name>", "Deploy imagePullSecret for Controller private registry.")
    .option("-y, --yes", "Skip confirmation prompts.")
    .action(async opts => {
      const valResp = validateImagePullSecretDetails(opts);
      if (!valResp.valid) {
        console.error(valResp.error);
        process.exit(1);
      }

      if (opts.pullSecret) {
        await deployImagePullSecret(generateImagePullSecret(opts), opts.pullSecret);
        return;
      }

      if (!(await getUserConfirmation(opts))) {
        process.exit(0);
      }

      await buildAndDeployModule(opts.image, opts.force);
    });
}

export function validateNamespaces(capability: CapabilityExport, webhook: Assets): void {
  namespaceComplianceValidator(capability, webhook.alwaysIgnore?.namespaces);
  namespaceComplianceValidator(
    capability,
    webhook.config.admission?.alwaysIgnore?.namespaces,
    false,
  );
  namespaceComplianceValidator(capability, webhook.config.watch?.alwaysIgnore?.namespaces, true);
}
