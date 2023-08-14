// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ClusterRole, V1ClusterRoleBinding } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";

import { Assets } from ".";
import { Kube } from "../k8s/raw";
import {
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

  Log.info("Creating namespace if it doesn't exist");
  try {
    await Kube(Namespace).Create(namespace);
  } catch (e) {
    // Silently ignore the error if the namespace already exists so we don't have to destroy the whole namespace
    Log.debug(e, "Namespace already exists");
  }

  // Create the mutating webhook configuration if it is needed
  const mutateWebhook = await webhookConfig(assets, "mutate", webhookTimeout);
  await Kube(MutatingWebhookConfiguration).WithName(name).Delete();
  if (mutateWebhook) {
    Log.info("Creating or replacing mutating webhook");
    await Kube(MutatingWebhookConfiguration).CreateOrReplace(mutateWebhook);
  } else {
    Log.info("Mutating webhook not needed");
  }

  // Create the validating webhook configuration if it is needed
  const validateWebhook = await webhookConfig(assets, "validate", webhookTimeout);
  await Kube(ValidatingWebhookConfiguration).WithName(name).Delete();
  if (validateWebhook) {
    Log.info("Creating or replacing validating webhook");
    await Kube(ValidatingWebhookConfiguration).CreateOrReplace(validateWebhook);
  } else {
    Log.info("Validating webhook not needed");
  }

  Log.info("Creating or the Pepr Store CRD if it doesn't exist");
  try {
    await Kube(CustomResourceDefinition).Create(peprStoreCRD);
  } catch (e) {
    // Silently ignore the error if the CRD already exists so we don't have to destroy the data
  }

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
  Log.info("Creating or replacing cluster role binding");
  const crb = clusterRoleBinding(name);
  await Kube(V1ClusterRoleBinding).CreateOrReplace(crb);

  Log.info("Creating or replacing cluster role");
  const cr = clusterRole(name);
  await Kube(V1ClusterRole).CreateOrReplace(cr);

  Log.info("Creating or replacing service account");
  const sa = serviceAccount(name);
  await Kube(ServiceAccount).CreateOrReplace(sa);

  Log.info("Creating or replacing store role");
  const role = storeRole(name);
  await Kube(Role).CreateOrReplace(role);

  Log.info("Creating or replacing store role binding");
  const roleBinding = storeRoleBinding(name);
  await Kube(RoleBinding).CreateOrReplace(roleBinding);
}

async function setupController(assets: Assets, code: Buffer, hash: string) {
  const { name } = assets;

  Log.info("Creating or replacing module secret");
  const mod = moduleSecret(name, code, hash);
  await Kube(Secret).CreateOrReplace(mod);

  Log.info("Creating service");
  const svc = service(name);
  await Kube(Service).CreateOrReplace(svc);

  Log.info("Creating or replacing TLS secret");
  const tls = tlsSecret(name, assets.tls);
  await Kube(Secret).CreateOrReplace(tls);

  Log.info("Creating or replacing API token secret");
  const apiToken = apiTokenSecret(name, assets.apiToken);
  await Kube(Secret).CreateOrReplace(apiToken);

  Log.info("Creating or replacing deployment");
  const dep = deployment(assets, hash);
  await Kube(Deployment).CreateOrReplace(dep);
}

async function setupWatcher(assets: Assets, hash: string) {
  // If the module has a watcher, deploy it
  const watchDeployment = watcher(assets, hash);
  if (watchDeployment) {
    Log.info("Creating or replacing watcher deployment");
    await Kube(Deployment).CreateOrReplace(watchDeployment);

    Log.info("Creating or replacing watcher service");
    const watchSvc = watcherService(assets.name);
    await Kube(Service).CreateOrReplace(watchSvc);
  }
}
