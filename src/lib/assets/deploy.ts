// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { promises as fs } from "fs";
import { K8s, kind } from "kubernetes-fluent-client";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";

import { Assets } from ".";
import Log from "../telemetry/logger";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { getDeployment, getModuleSecret, getNamespace, getWatcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfig } from "./webhooks";
import { CapabilityExport, ImagePullSecret } from "../types";

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
export async function deploy(assets: Assets, force: boolean, webhookTimeout?: number): Promise<void> {
  Log.info("Establishing connection to Kubernetes");

  const { name, host, path } = assets;

  Log.info("Applying pepr-system namespace");
  await K8s(kind.Namespace).Apply(getNamespace(assets.config.customLabels?.namespace));

  // Create the mutating webhook configuration if it is needed
  const mutateWebhook = await webhookConfig(assets, "mutate", webhookTimeout);
  if (mutateWebhook) {
    Log.info("Applying mutating webhook");
    await K8s(kind.MutatingWebhookConfiguration).Apply(mutateWebhook, { force });
  } else {
    Log.info("Mutating webhook not needed, removing if it exists");
    await K8s(kind.MutatingWebhookConfiguration).Delete(name);
  }

  // Create the validating webhook configuration if it is needed
  const validateWebhook = await webhookConfig(assets, "validate", webhookTimeout);
  if (validateWebhook) {
    Log.info("Applying validating webhook");
    await K8s(kind.ValidatingWebhookConfiguration).Apply(validateWebhook, { force });
  } else {
    Log.info("Validating webhook not needed, removing if it exists");
    await K8s(kind.ValidatingWebhookConfiguration).Delete(name);
  }

  Log.info("Applying the Pepr Store CRD if it doesn't exist");
  await K8s(kind.CustomResourceDefinition).Apply(peprStoreCRD, { force });

  // If a host is specified, we don't need to deploy the rest of the resources
  if (host) {
    return;
  }

  const code = await fs.readFile(path);
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  if (code.length < 1) {
    throw new Error("No code provided");
  }

  await setupRBAC(name, assets.capabilities, force, assets.config);
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

  Log.info("Applying API token secret");
  const apiToken = apiTokenSecret(name, assets.apiToken);
  await K8s(kind.Secret).Apply(apiToken, { force });

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
