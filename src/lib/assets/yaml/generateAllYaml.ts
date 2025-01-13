// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml, V1Deployment } from "@kubernetes/client-node";
import { promises as fs } from "fs";
import { apiTokenSecret, service, tlsSecret, watcherService } from "../networking";
import { getModuleSecret, getNamespace } from "../pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "../rbac";
import { webhookConfigGenerator } from "../webhooks";
import { Assets } from "../assets";

type deployments = { default: V1Deployment; watch: V1Deployment | null };

export async function generateAllYaml(assets: Assets, deployments: deployments): Promise<string> {
  const { name, tls, hash, apiToken, path, config } = assets;
  const code = await fs.readFile(path);

  const resources = [
    getNamespace(assets.config.customLabels?.namespace),
    clusterRole(name, assets.capabilities, config.rbacMode, config.rbac),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployments.default,
    service(name),
    watcherService(name),
    getModuleSecret(name, code, hash),
    storeRole(name),
    storeRoleBinding(name),
  ];

  const webhooks = {
    mutate: await webhookConfigGenerator(assets, "mutate", assets.config.webhookTimeout),
    validate: await webhookConfigGenerator(assets, "validate", assets.config.webhookTimeout),
  };

  if (webhooks.mutate) {
    resources.push(webhooks.mutate);
  }

  if (webhooks.validate) {
    resources.push(webhooks.validate);
  }

  if (deployments.watch) {
    resources.push(deployments.watch);
  }

  // Convert the resources to a single YAML string
  return resources.map(r => dumpYaml(r, { noRefs: true })).join("---\n");
}
