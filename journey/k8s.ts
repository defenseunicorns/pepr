// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, kind } from "kubernetes-fluent-client";

import { PeprStore } from "../src/lib/k8s";

export function delay2Secs() {
  return new Promise(resolve => setTimeout(resolve, 2000));
}

export async function deleteConfigMap(namespace: string, name: string) {
  try {
    await K8s(kind.ConfigMap).InNamespace(namespace).Delete(name);
  } catch (error) {
    // Do nothing
  }
}

export async function waitForDeploymentReady(namespace: string, name: string) {
  const deployment = await K8s(kind.Deployment).InNamespace(namespace).Get(name);
  const replicas = deployment.spec?.replicas || 1;
  const readyReplicas = deployment.status?.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await delay2Secs();
    return waitForDeploymentReady(namespace, name);
  }
}

export async function waitForPeprStoreKey(name: string, matchKey: string) {
  try {
    const store = await K8s(PeprStore).InNamespace("pepr-system").Get(name);
    if (store.data[matchKey]) {
      return store.data[matchKey];
    }

    throw new Error("Key not found");
  } catch (error) {
    await delay2Secs();
    return waitForPeprStoreKey(name, matchKey);
  }
}

export async function waitForNamespace(namespace: string) {
  try {
    return await K8s(kind.Namespace).Get(namespace);
  } catch (error) {
    await delay2Secs();
    return waitForNamespace(namespace);
  }
}

export async function waitForConfigMap(namespace: string, name: string) {
  try {
    return await K8s(kind.ConfigMap).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForConfigMap(namespace, name);
  }
}

export async function waitForSecret(namespace: string, name: string) {
  try {
    return await K8s(kind.Secret).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForSecret(namespace, name);
  }
}
