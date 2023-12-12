// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, kind } from "kubernetes-fluent-client";
import Log from "./logger";

// waits for all replicas to be ready for all deployments in the pepr-system namespace
export async function peprDeploymentsReady() {
  const deployments = await K8s(kind.Deployment).InNamespace("pepr-system").Get();
  let status = false;
  let readyCount = 0;

  for (const deployment of deployments.items) {
    while (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      const readyReplicas = deployment.status?.readyReplicas ? deployment.status?.readyReplicas : 0;
      Log.info(
        `Waiting for deployment ${deployment.metadata?.name} rollout to finish: ${readyReplicas} of ${deployment.spec?.replicas} replicas are available`,
      );
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    Log.info(`Deployment ${deployment.metadata?.name} is sucessfully rolled out`);
    readyCount++;
    Log.info(`${readyCount} deployments ready out of ${deployments.items.length} deployments`);
  }

  if (readyCount === deployments.items.length) {
    status = true;
  }

  return status;
}
