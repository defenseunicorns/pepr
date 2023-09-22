// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { Agent } from "http";

import { WatchPhase } from "../../types";
import { GroupVersionKind, KubernetesListObject, KubernetesObject, Paths } from "../types";

export type FetchMethods = "GET" | "APPLY" | "POST" | "PUT" | "DELETE" | "PATCH" | "WATCH";

export interface FetchOpts {
  agent: Agent;
  headers?: Record<string, string>;
  method?: FetchMethods;
  body?: string;
  signal?: AbortSignal | null | undefined;
}

export interface Filters {
  kindOverride?: GroupVersionKind;
  fields?: Record<string, string>;
  labels?: Record<string, string>;
  name?: string;
  namespace?: string;
}

export type GetFunction<K extends KubernetesObject> = {
  (): Promise<KubernetesListObject<K>>;
  (name: string): Promise<K>;
};

export type KubeFilteredActions<K extends KubernetesObject> = {
  /**
   * Get the resource or resources matching the filters.
   * If no filters are specified, all resources will be returned.
   * If a name is specified, only a single resource will be returned.
   */
  Get: GetFunction<K>;

  /**
   * Delete the resource if it exists.
   *
   * @param filter - the resource or resource name to delete
   */
  Delete: (filter?: K | string) => Promise<void>;

  /**
   *
   * @param callback
   * @returns
   */
  Watch: (callback: (payload: K, phase: WatchPhase) => void) => Promise<void>;
};

export type KubeUnfilteredActions<K extends KubernetesObject> = {
  /**
   * Perform a server-side apply of the provided K8s resource.
   *
   * @param resource
   * @returns
   */
  Apply: (resource: K) => Promise<K>;

  /**
   * Create the provided K8s resource or throw an error if it already exists.
   *
   * @param resource
   * @returns
   */
  Create: (resource: K) => Promise<K>;

  /**
   * Advanced JSON Patch operations for when Server Side Apply, Kube().Apply(), is insufficient.
   *
   * Note: Throws an error on an empty list of patch operations.
   *
   * @param payload The patch operations to run
   * @returns The patched resource
   */
  Patch: (payload: Operation[]) => Promise<K>;
};

export type KubeWithFilters<K extends KubernetesObject> = KubeFilteredActions<K> & {
  /**
   * Filter the query by the given field.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * Kube(given.Deployment)
   *  .WithField("metadata.name", "bar")
   *  .WithField("metadata.namespace", "qux")
   *  .Delete(...)
   * ```
   *
   * Will only delete the Deployment if it has the `metadata.name=bar` and `metadata.namespace=qux` fields.
   *
   * @param key  The field key
   * @param value The field value
   * @returns
   */
  WithField: <P extends Paths<K>>(key: P, value?: string) => KubeWithFilters<K>;

  /**
   * Filter the query by the given label. If no value is specified, the label simply must exist.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * Kube(given.Deployment)
   *   .WithLabel("foo", "bar")
   *   .WithLabel("baz", "qux")
   *   .Delete(...)
   * ```
   *
   * Will only delete the Deployment if it has the`foo=bar` and `baz=qux` labels.
   *
   * @param key The label key
   * @param value (optional) The label value
   */
  WithLabel: (key: string, value?: string) => KubeWithFilters<K>;
};

export type KubeInit<K extends KubernetesObject> = KubeWithFilters<K> &
  KubeUnfilteredActions<K> & {
    /**
     * Filter the query by the given namespace.
     *
     * @param namespace
     * @returns
     */
    InNamespace: (namespace: string) => KubeWithFilters<K>;
  };
