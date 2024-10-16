// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { KubernetesListObject, KubernetesObject } from "@kubernetes/client-node";
import { Operation } from "fast-json-patch";
import type { PartialDeep } from "type-fest";

import { GenericClass, GroupVersionKind } from "../types";
import { WatchCfg, Watcher } from "./watch";
import https from "https";
import { SecureClientSessionOptions } from "http2";
/**
 * Agent options for the the http2Watch
 */
export type AgentOptions = Pick<
  SecureClientSessionOptions,
  "ca" | "cert" | "key" | "rejectUnauthorized"
>;

/**
 * Options for the http2Watch
 */
export interface Options {
  agent?: https.Agent & { options?: AgentOptions };
}

/**
 * The Phase matched when using the K8s Watch API.
 */
export enum WatchPhase {
  Added = "ADDED",
  Modified = "MODIFIED",
  Deleted = "DELETED",
  Bookmark = "BOOKMARK",
  Error = "ERROR",
}

export type FetchMethods =
  | "GET"
  | "APPLY"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "WATCH"
  | "PATCH_STATUS"
  | "LOG";

export interface Filters {
  kindOverride?: GroupVersionKind;
  fields?: Record<string, string>;
  labels?: Record<string, string>;
  name?: string;
  namespace?: string;
}

/**
 * Get the resource or resources matching the filters.
 * If no filters are specified, all resources will be returned.
 * If a name is specified, only a single resource will be returned.
 *
 * @param name - (optional) the name of the resource to get
 * @returns the resource or list of resources
 */
export type GetFunction<K extends KubernetesObject> = {
  (): Promise<KubernetesListObject<K>>;
  (name: string): Promise<K>;
};

export type K8sFilteredActions<T extends GenericClass, K extends KubernetesObject> = {
  /**
   * Gets the logs.
   *
   * @param name - the name of the Object to get logs from
   * @returns array of logs
   */
  Logs: (name: string) => Promise<string[]>;
  /**
   * Get the resource or resources matching the filters.
   * If no filters are specified, all resources will be returned.
   * If a name is specified, only a single resource will be returned.
   */
  Get: GetFunction<K>;

  /**
   * Delete the resource matching the filters.
   *
   * @param filter - the resource or resource name to delete
   */
  Delete: (filter?: K | string) => Promise<void>;

  /**
   * Watch the resource matching the filters.
   *
   * @param callback - the callback function to call when an event occurs
   * @param watchCfg - (optional) watch configuration
   * @returns a watch controller
   */
  Watch: (callback: WatchAction<T>, watchCfg?: WatchCfg) => Watcher<T>;
};

export type K8sUnfilteredActions<K extends KubernetesObject> = {
  /**
   * Perform a server-side apply of the provided K8s resource.
   *
   * @param resource - the resource to apply
   * @param applyCfg - (optional) apply configuration
   * @returns the applied resource
   */
  Apply: (resource: PartialDeep<K>, applyCfg?: ApplyCfg) => Promise<K>;

  /**
   * Create the provided K8s resource or throw an error if it already exists.
   *
   * @param resource - the resource to create
   * @returns the created resource
   */
  Create: (resource: K) => Promise<K>;

  /**
   * Advanced JSON Patch operations for when Server Side Apply, K8s().Apply(), is insufficient.
   *
   * Note: Throws an error on an empty list of patch operations.
   *
   * @param payload The patch operations to run
   * @returns The patched resource
   */
  Patch: (payload: Operation[]) => Promise<K>;

  /**
   * Patch the status of the provided K8s resource. Note this is a special case of the Patch method that
   * only allows patching the status subresource. This can be used in Operator reconciliation loops to
   * update the status of a resource without triggering a new Generation of the resource.
   *
   * See https://stackoverflow.com/q/47100389/467373 for more details.
   *
   * IMPORTANT: This method will throw a 404 error if the resource does not have a status subresource defined.
   *
   * @param resource - the resource to patch
   * @returns the patched resource
   */
  PatchStatus: (resource: PartialDeep<K>) => Promise<K>;

  /**
   * Perform a raw GET request to the Kubernetes API. This is useful for calling endpoints that are not supported by the fluent API.
   * This command mirrors the `kubectl get --raw` command.
   *
   * E.g.
   *
   * ```ts
   * import { V1APIGroup } from "@kubernetes/client-node";
   *
   * K8s(V1APIGroup).Raw("/api")
   * ```
   *
   * will call the `/api` endpoint and is equivalent to `kubectl get --raw /api`.
   *
   * @param url the URL to call (e.g. /api)
   * @returns
   */
  Raw: (url: string, method?: FetchMethods) => Promise<K>;
};

export type K8sWithFilters<T extends GenericClass, K extends KubernetesObject> = K8sFilteredActions<
  T,
  K
> & {
  /**
   * Filter the query by the given field.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * K8s(kind.Deployment)
   * .WithField("metadata.name", "bar")
   * .WithField("metadata.namespace", "qux")
   * .Delete(...)
   * ```
   *
   * Will only delete the Deployment if it has the `metadata.name=bar` and `metadata.namespace=qux` fields.
   * Not all fields are supported, see https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/#supported-fields,
   * but Typescript will limit to only fields that exist on the resource.
   *
   * @param key - the field key
   * @param value - the field value
   * @returns the fluent API
   */
  WithField: <P extends Paths<K>>(key: P, value: string) => K8sWithFilters<T, K>;

  /**
   * Filter the query by the given label. If no value is specified, the label simply must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * K8s(kind.Deployment)
   * .WithLabel("foo", "bar")
   * .WithLabel("baz", "qux")
   * .WithLabel("quux")
   * .Delete(...)
   * ```
   *
   * Will only delete the Deployment if it has the`foo=bar` and `baz=qux` labels and the `quux` label exists.
   *
   * @param key - the label key
   * @param value - the label value
   * @returns the fluent API
   */
  WithLabel: (key: string, value?: string) => K8sWithFilters<T, K>;
};

/**
 * Configuration for the apply function.
 */
export type ApplyCfg = {
  /**
   * Force the apply to be a create.
   */
  force?: boolean;
};

export type K8sInit<T extends GenericClass, K extends KubernetesObject> = K8sWithFilters<T, K> &
  K8sUnfilteredActions<K> & {
    /**
     * Set the namespace filter.
     *
     * @param namespace - the namespace to filter on
     * @returns the fluent API
     */
    InNamespace: (namespace: string) => K8sWithFilters<T, K>;
  };

export type WatchAction<T extends GenericClass, K extends KubernetesObject = InstanceType<T>> = (
  update: K,
  phase: WatchPhase,
) => Promise<void> | void;

// Special types to handle the recursive keyof typescript lookup
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

export type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K]>> : never;
      }[keyof T]
    : "";
