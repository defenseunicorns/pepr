// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Kube, given } from "../src/lib";

export function delay2Secs() {
  return new Promise(resolve => setTimeout(resolve, 2000));
}

export async function deleteConfigMap(namespace: string, name: string) {
  try {
    await Kube(given.ConfigMap).InNamespace(namespace).Delete(name);
  } catch (error) {
    // Do nothing
  }
}

export async function waitForDeploymentReady(namespace: string, name: string) {
  const deployment = await Kube(given.Deployment).InNamespace(namespace).Get(name);
  const replicas = deployment.spec?.replicas || 1;
  const readyReplicas = deployment.status?.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await delay2Secs();
    return waitForDeploymentReady(namespace, name);
  }
}

export async function waitForNamespace(namespace: string) {
  try {
    return await Kube(given.Namespace).Get(namespace);
  } catch (error) {
    await delay2Secs();
    return waitForNamespace(namespace);
  }
}

export async function waitForConfigMap(namespace: string, name: string) {
  try {
    return await Kube(given.ConfigMap).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForConfigMap(namespace, name);
  }
}

export async function waitForSecret(namespace: string, name: string) {
  try {
    return await Kube(given.Secret).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForSecret(namespace, name);
  }
}
