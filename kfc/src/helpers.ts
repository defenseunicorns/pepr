// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { Cluster, KubeConfig } from "@kubernetes/client-node";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

/**
 *  Sleep for a number of seconds.
 *
 * @param seconds The number of seconds to sleep.
 * @returns A promise that resolves after the specified number of seconds.
 */
function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Get an environment variable (Node, Deno or Bun), or throw an error if it's not set.
 *
 * @example
 * const value = fromEnv("MY_ENV_VAR");
 * console.log(value);
 * // => "my-value"
 *
 * @example
 * const value = fromEnv("MY_MISSING_ENV_VAR");
 * // => Error: Environment variable MY_MISSING_ENV_VAR is not set
 *
 * @param name The name of the environment variable to get.
 * @returns The value of the environment variable.
 * @throws An error if the environment variable is not set.
 */
export function fromEnv(name: string): string {
  let envValue: string | undefined;

  // Check for Node.js or Bun
  if (typeof process !== "undefined" && typeof process.env !== "undefined") {
    envValue = process.env[name];
  }
  // Check for Deno
  else if (typeof Deno !== "undefined") {
    envValue = Deno.env.get(name);
  }
  // Otherwise, throw an error
  else {
    throw new Error("Unknown runtime environment");
  }

  if (typeof envValue === "undefined") {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return envValue;
}

/**
 * Wait for the Kubernetes cluster to be ready.
 *
 * @param seconds The number of seconds to wait for the cluster to be ready.
 * @returns The current cluster.
 */
export async function waitForCluster(seconds = 30): Promise<Cluster> {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();

  const cluster = kubeConfig.getCurrentCluster();
  if (!cluster) {
    await sleep(1);
    if (seconds > 0) {
      return await waitForCluster(seconds - 1);
    } else {
      throw new Error("Cluster not ready");
    }
  }

  return cluster;
}

/**
 * Determines if object has logs.
 *
 * @param kind The kind of Kubernetes object.
 * @returns boolean.
 */
export function hasLogs(kind: string): boolean {
  let hasSelector: boolean = false;
  switch (kind) {
    case "Pod":
      hasSelector = true;
      break;
    case "DaemonSet":
      hasSelector = true;
      break;
    case "ReplicaSet":
      hasSelector = true;
      break;
    case "Service":
      hasSelector = true;
      break;
    case "StatefulSet":
      hasSelector = true;
      break;
    case "Deployment":
      hasSelector = true;
      break;
  }
  return hasSelector;
}
