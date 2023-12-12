// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, kind } from "kubernetes-fluent-client";
import Log from "./logger";

// check to see if all replicas are ready for all deployments in the pepr-system namespace
// returns true if all deployments are ready, false otherwise
export async function checkPeprDeploymentStatus() {
  const deployments = await K8s(kind.Deployment).InNamespace("pepr-system").Get();
  let status = false;
  let readyCount = 0;

  for (const deployment of deployments.items) {
    const readyReplicas = deployment.status?.readyReplicas ? deployment.status?.readyReplicas : 0;
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      Log.info(
        `Waiting for deployment ${deployment.metadata?.name} rollout to finish: ${readyReplicas} of ${deployment.spec?.replicas} replicas are available`
      );
    } else {
      Log.info(
        `Deployment ${deployment.metadata?.name} rolled out: ${readyReplicas} of ${deployment.spec?.replicas} replicas are available`
      );
      readyCount++;
    }
  }
  if (readyCount === deployments.items.length) {
    status = true;
  }
  return status;
}

// wait for all deployments in the pepr-system namespace to be ready
export async function peprDeploymentsReady() {
  Log.info(`🔍 Checking pepr-system deployments status...`);
  let ready = await checkPeprDeploymentStatus();
  while (!ready) {
    Log.info(`❌ Not all pepr-system deployments are ready`);
    ready = await checkPeprDeploymentStatus();
  }
  Log.info(`✅ All pepr-system deployments are ready`);
}