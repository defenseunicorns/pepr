// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { promises as fs } from "fs";
import { K8s, kind } from "kubernetes-fluent-client";

import { Assets } from ".";
import Log from "../logger";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfig } from "./webhooks";
import { CapabilityExport } from "../types";

export async function deploy(assets: Assets, webhookTimeout?: number) {
  Log.info("Establishing connection to Kubernetes");

  const { name, host, path } = assets;

  Log.info("Applying pepr-system namespace");
  await K8s(kind.Namespace).Apply(namespace);

  // Create the mutating webhook configuration if it is needed
  const mutateWebhook = await webhookConfig(assets, "mutate", webhookTimeout);
  if (mutateWebhook) {
    Log.info("Applying mutating webhook");
    await K8s(kind.MutatingWebhookConfiguration).Apply(mutateWebhook);
  } else {
    Log.info("Mutating webhook not needed, removing if it exists");
    await K8s(kind.MutatingWebhookConfiguration).Delete(name);
  }

  // Create the validating webhook configuration if it is needed
  const validateWebhook = await webhookConfig(assets, "validate", webhookTimeout);
  if (validateWebhook) {
    Log.info("Applying validating webhook");
    await K8s(kind.ValidatingWebhookConfiguration).Apply(validateWebhook);
  } else {
    Log.info("Validating webhook not needed, removing if it exists");
    await K8s(kind.ValidatingWebhookConfiguration).Delete(name);
  }

  Log.info("Applying the Pepr Store CRD if it doesn't exist");
  await K8s(kind.CustomResourceDefinition).Apply(peprStoreCRD);

  // If a host is specified, we don't need to deploy the rest of the resources
  if (host) {
    return;
  }

  const code = await fs.readFile(path);
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  if (code.length < 1) {
    throw new Error("No code provided");
  }

  await setupRBAC(name, assets.capabilities);
  await setupController(assets, code, hash);
  await setupWatcher(assets, hash);
}

async function setupRBAC(name: string, capabilities: CapabilityExport[]) {
  Log.info("Applying cluster role binding");
  const crb = clusterRoleBinding(name);
  await K8s(kind.ClusterRoleBinding).Apply(crb);

  Log.info("Applying cluster role");
  const cr = clusterRole(name, capabilities);
  await K8s(kind.ClusterRole).Apply(cr);

  Log.info("Applying service account");
  const sa = serviceAccount(name);
  await K8s(kind.ServiceAccount).Apply(sa);

  Log.info("Applying store role");
  const role = storeRole(name);
  await K8s(kind.Role).Apply(role);

  Log.info("Applying store role binding");
  const roleBinding = storeRoleBinding(name);
  await K8s(kind.RoleBinding).Apply(roleBinding);
}

async function setupController(assets: Assets, code: Buffer, hash: string) {
  const { name } = assets;

  Log.info("Applying module secret");
  const mod = moduleSecret(name, code, hash);
  await K8s(kind.Secret).Apply(mod);

  Log.info("Applying controller service");
  const svc = service(name);
  await K8s(kind.Service).Apply(svc);

  Log.info("Applying TLS secret");
  const tls = tlsSecret(name, assets.tls);
  await K8s(kind.Secret).Apply(tls);

  Log.info("Applying API token secret");
  const apiToken = apiTokenSecret(name, assets.apiToken);
  await K8s(kind.Secret).Apply(apiToken);

  Log.info("Applying deployment");
  const dep = deployment(assets, hash);
  await K8s(kind.Deployment).Apply(dep);
}

async function setupWatcher(assets: Assets, hash: string) {
  // If the module has a watcher, deploy it
  const watchDeployment = watcher(assets, hash);
  if (watchDeployment) {
    Log.info("Applying watcher deployment");
    await K8s(kind.Deployment).Apply(watchDeployment);

    Log.info("Applying watcher service");
    const watchSvc = watcherService(assets.name);
    await K8s(kind.Service).Apply(watchSvc);
  }
}
