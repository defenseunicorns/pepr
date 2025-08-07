// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "../../lib/types";
import { Assets } from "../../lib/assets/assets";
import { Command } from "commander";
import { deployImagePullSecret } from "../../lib/assets/deploy";
import { namespaceComplianceValidator } from "../../lib/helpers";
import { validateImagePullSecretDetails, generateImagePullSecret } from "./imagePullSecret";
import { getUserConfirmation } from "./userConfirmation";
import { buildAndDeployModule } from "./buildAndDeploy";

export default function (program: Command): void {
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
