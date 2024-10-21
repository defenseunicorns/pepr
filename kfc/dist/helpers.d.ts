import { Cluster } from "@kubernetes/client-node";
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
export declare function fromEnv(name: string): string;
/**
 * Wait for the Kubernetes cluster to be ready.
 *
 * @param seconds The number of seconds to wait for the cluster to be ready.
 * @returns The current cluster.
 */
export declare function waitForCluster(seconds?: number): Promise<Cluster>;
/**
 * Determines if object has logs.
 *
 * @param kind The kind of Kubernetes object.
 * @returns boolean.
 */
export declare function hasLogs(kind: string): boolean;
//# sourceMappingURL=helpers.d.ts.map