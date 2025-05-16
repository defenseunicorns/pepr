// check to see if all replicas are ready for all deployments in the pepr-system namespace

import { K8s, kind } from "kubernetes-fluent-client";
import Log from "./telemetry/logger";

/**
 * Checks whether all deployments in the specified Kubernetes namespace are fully rolled out.
 *
 * A deployment is considered ready when the number of `readyReplicas` equals the desired `replicas`.
 * Logs the rollout status of each deployment.
 *
 * @param {string} namespace - The Kubernetes namespace to check.
 * @returns {Promise<boolean>} - `true` if all deployments are ready, otherwise `false`.
 */
export async function checkDeploymentStatus(namespace: string): Promise<boolean> {
  const deployments = await K8s(kind.Deployment).InNamespace(namespace).Get();

  let allReady = true;

  for (const deployment of deployments.items) {
    const name = deployment.metadata?.name ?? "unknown";

    if (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      Log.info(
        `Waiting for deployment ${name} rollout to finish: ${deployment.status?.readyReplicas} of ${deployment.spec?.replicas} replicas are available`,
      );
      allReady = false;
    } else {
      Log.info(
        `Deployment ${name} rolled out: ${deployment.status?.readyReplicas} of ${deployment.spec?.replicas} replicas are available`,
      );
    }
  }

  return allReady;
}

// wait for all deployments in the pepr-system namespace to be ready
export async function namespaceDeploymentsReady(
  namespace: string = "pepr-system",
): Promise<true | undefined> {
  Log.info(`Checking ${namespace} deployments status...`);
  let ready = false;
  while (!ready) {
    ready = await checkDeploymentStatus(namespace);
    if (ready) {
      return ready;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  Log.info(`All ${namespace} deployments are ready`);
}
