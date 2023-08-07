// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AppsV1Api, CoreV1Api, HttpError, KubeConfig, RbacAuthorizationV1Api } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";

import { Assets } from ".";
import { Kube } from "../k8s/raw";
import {
  CustomResourceDefinition,
  MutatingWebhookConfiguration,
  Namespace,
  ValidatingWebhookConfiguration,
} from "../k8s/upstream";
import Log from "../logger";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount } from "./rbac";
import { peprStoreCRD } from "./store";
import { webhookConfig } from "./webhooks";

export async function deploy(assets: Assets, webhookTimeout?: number) {
  Log.info("Establishing connection to Kubernetes");

  const peprNS = "pepr-system";
  const { name, host, path } = assets;

  // Deploy the resources using the k8s API
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();

  const coreV1Api = kubeConfig.makeApiClient(CoreV1Api);

  Log.SetLogLevel("debug");
  Log.info("Creating namespace");
  try {
    await Kube(Namespace).Create(namespace);
  } catch (e) {
    // Silently ignore the error if the namespace already exists so we don't have to destroy the whole namespace
    Log.debug(e, "Failed to create namespace");
  }

  // Create the mutating webhook configuration if it is needed
  const mutateWebhook = await webhookConfig(assets, "mutate", webhookTimeout);
  if (mutateWebhook) {
    Log.info("Creating or replacing mutating webhook");
    await Kube(MutatingWebhookConfiguration).CreateOrReplace(mutateWebhook);
  }

  // Create the validating webhook configuration if it is needed
  const validateWebhook = await webhookConfig(assets, "validate", webhookTimeout);
  if (validateWebhook) {
    Log.info("Creating or replacing validating webhook");
    await Kube(ValidatingWebhookConfiguration).CreateOrReplace(validateWebhook);
  }

  Log.info("Creating or replacing Pepr Store CRD");
  await Kube(CustomResourceDefinition).CreateOrReplace(peprStoreCRD);

  // If a host is specified, we don't need to deploy the rest of the resources
  if (host) {
    return;
  }

  if (!path) {
    throw new Error("No code provided");
  }

  const code = await fs.readFile(path);

  const hash = crypto.createHash("sha256").update(code).digest("hex");

  const appsApi = kubeConfig.makeApiClient(AppsV1Api);
  const rbacApi = kubeConfig.makeApiClient(RbacAuthorizationV1Api);

  const crb = clusterRoleBinding(name);
  try {
    Log.info("Creating cluster role binding");
    await rbacApi.createClusterRoleBinding(crb);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating cluster role binding");
    await rbacApi.deleteClusterRoleBinding(crb.metadata?.name ?? "");
    await rbacApi.createClusterRoleBinding(crb);
  }

  const cr = clusterRole(name);
  try {
    Log.info("Creating cluster role");
    await rbacApi.createClusterRole(cr);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating  the cluster role");
    try {
      await rbacApi.deleteClusterRole(cr.metadata?.name ?? "");
      await rbacApi.createClusterRole(cr);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
    }
  }

  const sa = serviceAccount(name);
  try {
    Log.info("Creating service account");
    await coreV1Api.createNamespacedServiceAccount(peprNS, sa);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating service account");
    await coreV1Api.deleteNamespacedServiceAccount(sa.metadata?.name ?? "", peprNS);
    await coreV1Api.createNamespacedServiceAccount(peprNS, sa);
  }

  const mod = moduleSecret(name, code, hash);
  try {
    Log.info("Creating module secret");
    await coreV1Api.createNamespacedSecret(peprNS, mod);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating module secret");
    await coreV1Api.deleteNamespacedSecret(mod.metadata?.name ?? "", peprNS);
    await coreV1Api.createNamespacedSecret(peprNS, mod);
  }

  const svc = service(name);
  try {
    Log.info("Creating service");
    await coreV1Api.createNamespacedService(peprNS, svc);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating service");
    await coreV1Api.deleteNamespacedService(svc.metadata?.name ?? "", peprNS);
    await coreV1Api.createNamespacedService(peprNS, svc);
  }

  const tls = tlsSecret(name, assets.tls);
  try {
    Log.info("Creating TLS secret");
    await coreV1Api.createNamespacedSecret(peprNS, tls);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating TLS secret");
    await coreV1Api.deleteNamespacedSecret(tls.metadata?.name ?? "", peprNS);
    await coreV1Api.createNamespacedSecret(peprNS, tls);
  }

  const apiToken = apiTokenSecret(name, assets.apiToken);
  try {
    Log.info("Creating API token secret");
    await coreV1Api.createNamespacedSecret(peprNS, apiToken);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating API token secret");
    await coreV1Api.deleteNamespacedSecret(apiToken.metadata?.name ?? "", peprNS);
    await coreV1Api.createNamespacedSecret(peprNS, apiToken);
  }

  const dep = deployment(assets, hash);
  try {
    Log.info("Creating deployment");
    await appsApi.createNamespacedDeployment(peprNS, dep);
  } catch (e) {
    Log.debug(e instanceof HttpError ? e.body : e);
    Log.info("Removing and re-creating deployment");
    await appsApi.deleteNamespacedDeployment(dep.metadata?.name ?? "", peprNS);
    await appsApi.createNamespacedDeployment(peprNS, dep);
  }

  // If the module has a watcher, deploy it
  const watchDeployment = watcher(assets, hash);
  if (watchDeployment) {
    try {
      Log.info("Creating watcher statefulset");
      await appsApi.createNamespacedDeployment(peprNS, watchDeployment);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating watcher statefulset");
      await appsApi.deleteNamespacedDeployment(watchDeployment.metadata?.name ?? "", peprNS);
      await appsApi.createNamespacedDeployment(peprNS, watchDeployment);
    }

    const watchSvc = watcherService(name);
    try {
      Log.info("Creating watcher service");
      await coreV1Api.createNamespacedService(peprNS, watchSvc);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating watcher service");
      await coreV1Api.deleteNamespacedService(watchSvc.metadata?.name ?? "", peprNS);
      await coreV1Api.createNamespacedService(peprNS, watchSvc);
    }
  }
}
