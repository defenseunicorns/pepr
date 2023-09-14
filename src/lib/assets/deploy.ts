// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { promises as fs } from "fs";

import { Assets } from ".";
import { Kube } from "../k8s/fluent/kube";
import {
  ClusterRole,
  ClusterRoleBinding,
  CustomResourceDefinition,
  Deployment,
  MutatingWebhookConfiguration,
  Namespace,
  Role,
  RoleBinding,
  Secret,
  Service,
  ServiceAccount,
  ValidatingWebhookConfiguration,
} from "../k8s/upstream";
import Log from "../logger";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfig } from "./webhooks";

export async function deploy(assets: Assets, webhookTimeout?: number) {
  Log.info("Establishing connection to Kubernetes");

  const { name, host, path } = assets;

  Log.info("Applying pepr-system namespace");
  await Kube(Namespace).Apply(namespace);

  // Create the mutating webhook configuration if it is needed
  const mutateWebhook = await webhookConfig(assets, "mutate", webhookTimeout);
  if (mutateWebhook) {
    Log.info("Applying mutating webhook");
    await Kube(MutatingWebhookConfiguration).Apply(mutateWebhook);
  } else {
    Log.info("Mutating webhook not needed, removing if it exists");
    await Kube(MutatingWebhookConfiguration).Delete(name);
  }

  // Create the validating webhook configuration if it is needed
  const validateWebhook = await webhookConfig(assets, "validate", webhookTimeout);
  if (validateWebhook) {
    Log.info("Applying validating webhook");
    await Kube(ValidatingWebhookConfiguration).Apply(validateWebhook);
  } else {
    Log.info("Validating webhook not needed, removing if it exists");
    await Kube(ValidatingWebhookConfiguration).Delete(name);
  }

  Log.info("Applying the Pepr Store CRD if it doesn't exist");
  await Kube(CustomResourceDefinition).Apply(peprStoreCRD);

  // If a host is specified, we don't need to deploy the rest of the resources
  if (host) {
    return;
  }

  const code = await fs.readFile(path);
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  if (code.length < 1) {
    throw new Error("No code provided");
  }

  await setupRBAC(name);
  await setupController(assets, code, hash);
  await setupWatcher(assets, hash);
}

async function setupRBAC(name: string) {
  Log.info("Applying cluster role binding");
  const crb = clusterRoleBinding(name);
  await Kube(ClusterRoleBinding).Apply(crb);

  Log.info("Applying cluster role");
  const cr = clusterRole(name);
  await Kube(ClusterRole).Apply(cr);

  Log.info("Applying service account");
  const sa = serviceAccount(name);
  await Kube(ServiceAccount).Apply(sa);

  Log.info("Applying store role");
  const role = storeRole(name);
  await Kube(Role).Apply(role);

  Log.info("Applying store role binding");
  const roleBinding = storeRoleBinding(name);
  await Kube(RoleBinding).Apply(roleBinding);
}

async function setupController(assets: Assets, code: Buffer, hash: string) {
  const { name } = assets;

  Log.info("Applying module secret");
  const mod = moduleSecret(name, code, hash);
  await Kube(Secret).Apply(mod);

  Log.info("Applying controller service");
  const svc = service(name);
  await Kube(Service).Apply(svc);

  Log.info("Applying TLS secret");
  const tls = tlsSecret(name, assets.tls);
  await Kube(Secret).Apply(tls);

  Log.info("Applying API token secret");
  const apiToken = apiTokenSecret(name, assets.apiToken);
  await Kube(Secret).Apply(apiToken);

  Log.info("Applying deployment");
  const dep = deployment(assets, hash);
  await Kube(Deployment).Apply(dep);
}

async function setupWatcher(assets: Assets, hash: string) {
  // If the module has a watcher, deploy it
  const watchDeployment = watcher(assets, hash);
  if (watchDeployment) {
    Log.info("Applying watcher deployment");
    await Kube(Deployment).Apply(watchDeployment);

    Log.info("Applying watcher service");
    const watchSvc = watcherService(assets.name);
    await Kube(Service).Apply(watchSvc);
  }
}
