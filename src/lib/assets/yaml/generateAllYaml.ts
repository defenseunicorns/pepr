// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { Assets } from "../assets";
import { WebhookType } from "../../enums";
import { apiPathSecret, tlsSecret } from "../networking";
import {
  clusterRole,
  clusterRoleBinding,
  serviceAccount,
  storeRole,
  storeRoleBinding,
} from "../rbac";
import { dumpYaml, V1Deployment } from "@kubernetes/client-node";
import { getModuleSecret, getNamespace, watcherService, service } from "../k8sObjects";
import { promises as fs } from "fs";
import { webhookConfigGenerator } from "../webhooks";

type deployments = { default: V1Deployment; watch: V1Deployment | null };

export async function generateAllYaml(assets: Assets, deployments: deployments): Promise<string> {
  const { name, tls, apiPath, path, config } = assets;
  const code = await fs.readFile(path);
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  const resources = [
    getNamespace(assets.config.customLabels?.namespace),
    clusterRole(name, assets.capabilities, config.rbacMode, config.rbac),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiPathSecret(name, apiPath),
    tlsSecret(name, tls),
    deployments.default,
    service(name),
    watcherService(name),
    getModuleSecret(name, code, hash),
    storeRole(name),
    storeRoleBinding(name),
  ];

  const webhooks = {
    mutate: await webhookConfigGenerator(assets, WebhookType.MUTATE, assets.config.webhookTimeout),
    validate: await webhookConfigGenerator(
      assets,
      WebhookType.VALIDATE,
      assets.config.webhookTimeout,
    ),
  };

  // Add webhooks and watch deployment if they exist
  const additionalResources = [webhooks.mutate, webhooks.validate, deployments.watch].filter(
    resource => resource !== null && resource !== undefined,
  );

  resources.push(...additionalResources);

  // Convert the resources to a single YAML string
  return resources.map(resource => dumpYaml(resource, { noRefs: true })).join("---\n");
}
