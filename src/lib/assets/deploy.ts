// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { promises as fs } from "fs";
import { K8s, kind } from "kubernetes-fluent-client";

import { Assets } from ".";
import Log from "../logger";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import {
  getAllClusterRoles,
  getAllClusterRoleBindings,
  getAllServiceAccounts,
  getAllRoles,
  getAllRoleBindings,
} from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfig } from "./webhooks";
import { CapabilityExport, ImagePullSecret } from "../types";

export async function deployImagePullSecret(imagePullSecret: ImagePullSecret, name: string) {
  try {
    await K8s(kind.Namespace).Get("pepr-system");
  } catch {
    await K8s(kind.Namespace).Apply(namespace());
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
export async function deploy(assets: Assets, force: boolean, webhookTimeout?: number) {
  Log.info("Establishing connection to Kubernetes");

  const { name, host, path } = assets;

  Log.info("Applying pepr-system namespace");
  await K8s(kind.Namespace).Apply(namespace(assets.config.customLabels?.namespace));

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

  await setupRBAC(name, assets.capabilities, force);
  await setupController(assets, code, hash, force);
  await setupWatcher(assets, hash, force);
}

async function setupRBAC(name: string, capabilities: CapabilityExport[], force: boolean) {
  Log.info("Applying cluster role bindings");
  const clusterRoleBindings = getAllClusterRoleBindings(name);
  for (const crb of clusterRoleBindings) {
    await K8s(kind.ClusterRoleBinding).Apply(crb, { force });
  }

  Log.info("Applying cluster roles");
  const clusterRoles = getAllClusterRoles(name, capabilities);
  for (const cr of clusterRoles) {
    await K8s(kind.ClusterRole).Apply(cr, { force });
  }

  Log.info("Applying service accounts");
  const serviceAccounts = getAllServiceAccounts(name);
  for (const sa of serviceAccounts) {
    await K8s(kind.ServiceAccount).Apply(sa, { force });
  }

  Log.info("Applying store roles");
  const roles = getAllRoles(name);
  for (const role of roles) {
    await K8s(kind.Role).Apply(role, { force });
  }

  Log.info("Applying store role bindings");
  const roleBindings = getAllRoleBindings(name);
  for (const rb of roleBindings) {
    await K8s(kind.RoleBinding).Apply(rb, { force });
  }
}

async function setupController(assets: Assets, code: Buffer, hash: string, force: boolean) {
  const { name } = assets;

  Log.info("Applying module secret");
  const mod = moduleSecret(name, code, hash);
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
  const dep = deployment(assets, hash, assets.buildTimestamp);
  await K8s(kind.Deployment).Apply(dep, { force });
}

async function setupWatcher(assets: Assets, hash: string, force: boolean) {
  // If the module has a watcher, deploy it
  const watchDeployment = watcher(assets, hash, assets.buildTimestamp);
  if (watchDeployment) {
    Log.info("Applying watcher deployment");
    await K8s(kind.Deployment).Apply(watchDeployment, { force });

    Log.info("Applying watcher service");
    const watchSvc = watcherService(assets.name);
    await K8s(kind.Service).Apply(watchSvc, { force });
  }
}
