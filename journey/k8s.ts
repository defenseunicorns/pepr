// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AppsV1Api, CoreV1Api, KubeConfig, V1ConfigMap } from "@kubernetes/client-node";

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

function delay2Secs() {
  return new Promise(resolve => setTimeout(resolve, 2000));
}

export async function createOrReplaceConfigMap(cm: V1ConfigMap) {
  const ns = cm.metadata?.namespace || "default";
  try {
    const resp = await k8sCoreApi.createNamespacedConfigMap(ns, cm);
    return resp.body;
  } catch (error) {
    const resp = await k8sCoreApi.replaceNamespacedConfigMap(cm.metadata?.name || "", ns, cm);
    return resp.body;
  }
}

export async function deleteConfigMap(namespace: string, name: string) {
  try {
    await k8sCoreApi.deleteNamespacedConfigMap(name, namespace);
  } catch (error) {
    // Do nothing
  }
}

export async function waitForDeploymentReady(namespace: string, name: string) {
  const deployment = await k8sApi.readNamespacedDeployment(name, namespace);
  const replicas = deployment.body.spec?.replicas || 1;
  const readyReplicas = deployment.body.status?.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await delay2Secs();
    return waitForDeploymentReady(namespace, name);
  }
}

export async function waitForNamespace(namespace: string) {
  try {
    const resp = await k8sCoreApi.readNamespace(namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForNamespace(namespace);
  }
}

export async function waitForConfigMap(namespace: string, name: string) {
  try {
    const resp = await k8sCoreApi.readNamespacedConfigMap(name, namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForConfigMap(namespace, name);
  }
}

export async function waitForSecret(namespace: string, name: string) {
  try {
    const resp = await k8sCoreApi.readNamespacedSecret(name, namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForSecret(namespace, name);
  }
}

export async function getPodLogs(namespace: string, labelSelector: string) {
  let allLogs = "";

  try {
    const res = await k8sCoreApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector,
    );
    const pods = res.body.items;

    for (const pod of pods) {
      const podName = pod.metadata?.name || "unknown";
      const log = await k8sCoreApi.readNamespacedPodLog(podName, namespace);
      allLogs += log.body;
    }
  } catch (err) {
    console.error("Error: ", err);
  }

  return allLogs;
}
