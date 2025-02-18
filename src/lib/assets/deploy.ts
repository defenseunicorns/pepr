// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { promises as fs } from "fs";
import { K8s, kind } from "kubernetes-fluent-client";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";

import { Assets } from "./assets";
import Log from "../telemetry/logger";
import { apiPathSecret, service, tlsSecret, watcherService } from "./networking";
import { getDeployment, getModuleSecret, getNamespace, getWatcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfigGenerator } from "./webhooks";
import { CapabilityExport, ImagePullSecret } from "../types";
import { WebhookType } from "../enums";

export async function deployImagePullSecret(imagePullSecret: ImagePullSecret, name: string): Promise<void> {
  try {
    await K8s(kind.Namespace).Get("pepr-system");
  } catch {
    await K8s(kind.Namespace).Apply(getNamespace());
  }

  try {
    await K8s(kind.Secret).Apply(
      {
        apiVersion: "v1",
        kind: "Secret",
        metadata: {
          name,
          namespace: "pepr-system",
        },
        type: "kubernetes.io/dockerconfigjson",
        data: {
          ".dockerconfigjson": Buffer.from(JSON.stringify(imagePullSecret)).toString("base64"),
        },
      },
      { force: true },
    );
  } catch (e) {
    Log.error(e);
  }
}

async function handleWebhookConfiguration(
  assets: Assets,
  type: WebhookType,
  webhookTimeout: number,
  force: boolean,
): Promise<void> {
  const kindMap = {
    mutate: kind.MutatingWebhookConfiguration,
    validate: kind.ValidatingWebhookConfiguration,
  };

  const webhookConfig = await webhookConfigGenerator(assets, type, webhookTimeout);

  if (webhookConfig) {
    Log.info(`Applying ${type} webhook`);
    await K8s(kindMap[type]).Apply(webhookConfig, { force });
  } else {
    Log.info(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook not needed, removing if it exists`);
    await K8s(kindMap[type]).Delete(assets.name);
  }
}

export async function deployWebhook(assets: Assets, force: boolean, webhookTimeout: number): Promise<void> {
  Log.info("Establishing connection to Kubernetes");

  Log.info("Applying pepr-system namespace");
  await K8s(kind.Namespace).Apply(getNamespace(assets.config.customLabels?.namespace));

  // Create the mutating webhook configuration if it is needed
  await handleWebhookConfiguration(assets, WebhookType.MUTATE, webhookTimeout, force);

  // Create the validating webhook configuration if it is needed
  await handleWebhookConfiguration(assets, WebhookType.VALIDATE, webhookTimeout, force);

  Log.info("Applying the Pepr Store CRD if it doesn't exist");
  await K8s(kind.CustomResourceDefinition).Apply(peprStoreCRD, { force });

  if (assets.host) return; // Skip resource deployment if a host is already specified

  const code = await fs.readFile(assets.path);
  if (!code.length) throw new Error("No code provided");
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  await setupRBAC(assets.name, assets.capabilities, force, assets.config);
  await setupController(assets, code, hash, force);
  await setupWatcher(assets, hash, force);
}

async function setupRBAC(
  name: string,
  capabilities: CapabilityExport[],
  force: boolean,
  config: { rbacMode?: string; rbac?: PolicyRule[] },
): Promise<void> {
  const { rbacMode, rbac } = config;

  Log.info("Applying cluster role binding");
  const crb = clusterRoleBinding(name);
  await K8s(kind.ClusterRoleBinding).Apply(crb, { force });

  Log.info("Applying cluster role");
  const cr = clusterRole(name, capabilities, rbacMode, rbac);
  await K8s(kind.ClusterRole).Apply(cr, { force });

  Log.info("Applying service account");
  const sa = serviceAccount(name);
  await K8s(kind.ServiceAccount).Apply(sa, { force });

  Log.info("Applying store role");
  const role = storeRole(name);
  await K8s(kind.Role).Apply(role, { force });

  Log.info("Applying store role binding");
  const roleBinding = storeRoleBinding(name);
  await K8s(kind.RoleBinding).Apply(roleBinding, { force });
}

async function setupController(assets: Assets, code: Buffer, hash: string, force: boolean): Promise<void> {
  const { name } = assets;

  Log.info("Applying module secret");
  const mod = getModuleSecret(name, code, hash);
  await K8s(kind.Secret).Apply(mod, { force });

  Log.info("Applying controller service");
  const svc = service(name);
  await K8s(kind.Service).Apply(svc, { force });

  Log.info("Applying TLS secret");
  const tls = tlsSecret(name, assets.tls);
  await K8s(kind.Secret).Apply(tls, { force });

  Log.info("Applying API path secret");
  const apiPath = apiPathSecret(name, assets.apiPath);
  await K8s(kind.Secret).Apply(apiPath, { force });

  Log.info("Applying deployment");
  const dep = getDeployment(assets, hash, assets.buildTimestamp);
  await K8s(kind.Deployment).Apply(dep, { force });
}

// Setup the watcher deployment and service
async function setupWatcher(assets: Assets, hash: string, force: boolean): Promise<void> {
  // If the module has a watcher, deploy it
  const watchDeployment = getWatcher(assets, hash, assets.buildTimestamp);
  if (watchDeployment) {
    Log.info("Applying watcher deployment");
    await K8s(kind.Deployment).Apply(watchDeployment, { force });

    Log.info("Applying watcher service");
    const watchSvc = watcherService(assets.name);
    await K8s(kind.Service).Apply(watchSvc, { force });
  }
}
