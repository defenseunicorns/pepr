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
import { dumpYaml, V1Deployment, V1Service, KubernetesObject } from "@kubernetes/client-node";
import { getModuleSecret, getNamespace } from "../k8sObjects";
import { promises as fs } from "fs";
import { webhookConfigGenerator } from "../webhooks";

type deployments = { admission: V1Deployment | null; watch: V1Deployment | null };
type services = {
  admission: V1Service | null;
  watch: V1Service | null;
};

function pushControllerManifests(
  resources: KubernetesObject[],
  deployments: deployments,
  services: services,
): KubernetesObject[] {
  if (deployments.watch) {
    resources.push(deployments.watch);
  }
  if (deployments.admission) {
    resources.push(deployments.admission);
  }
  if (services.admission) {
    resources.push(services.admission);
  }
  if (services.watch) {
    resources.push(services.watch);
  }
  return resources;
}

export async function generateAllYaml(
  assets: Assets,
  deployments: deployments,
  services: services,
): Promise<string> {
  const { name, tls, apiPath, path, config } = assets;
  const code = await fs.readFile(path);
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  let resources = [
    getNamespace(assets.config.customLabels?.namespace),
    clusterRole(name, assets.capabilities, config.rbacMode, config.rbac),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiPathSecret(name, apiPath),
    tlsSecret(name, tls),
    getModuleSecret(name, code, hash),
    storeRole(name),
    storeRoleBinding(name),
  ];

  resources = pushControllerManifests(resources, deployments, services);

  const webhooks = {
    mutate: await webhookConfigGenerator(assets, WebhookType.MUTATE, assets.config.webhookTimeout),
    validate: await webhookConfigGenerator(
      assets,
      WebhookType.VALIDATE,
      assets.config.webhookTimeout,
    ),
  };

  // Add webhooks if they exist
  const additionalResources = [webhooks.mutate, webhooks.validate].filter(
    resource => resource !== null && resource !== undefined,
  );

  resources.push(...additionalResources);

  // Convert the resources to a single YAML string
  return resources.map(resource => dumpYaml(resource, { noRefs: true })).join("---\n");
}
