// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, kind, KubernetesListObject } from "kubernetes-fluent-client";
import Log from "./logger";

// get all deployments
export async function getDeployments() {
  const deployments = await K8s(kind.Deployment).InNamespace('pepr-system').Get();
  return deployments;
}

// waits for all replicas to be ready for all deployments
export async function waitForAllDeploymentReplicas(deployments: KubernetesListObject<kind.Deployment>) {
  let status = false;
  let readyCount = 0;

  if (deployments.items.length === 0) {
    Log.info('No deployments found');
    return status;
  }

  for (const deployment of deployments.items) {
    Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is deploying`)

    while (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      const readyReplicas = deployment.status?.readyReplicas ? deployment.status?.readyReplicas : 0;
      Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is not ready - ${readyReplicas} ready replicas out of ${deployment.spec?.replicas} spec replicas`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

      Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is ready with ${deployment.status?.readyReplicas} ready replicas out of ${deployment.spec?.replicas} spec replicas`);
      readyCount++;
      Log.info(`${readyCount} deployments ready out of ${deployments.items.length} deployments`);

  }

  if (readyCount === deployments.items.length) {
    status = true;
  }

  return status
}

// check to see if all replicas are ready for all deployments
export async function checkAllDeploymentReplicas() {
  const deployments = await getDeployments();
  const status = await waitForAllDeploymentReplicas(deployments);
  return status
}