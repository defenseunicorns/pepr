// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { Agent } from "http";

import { GroupVersionKind, KubernetesListObject, KubernetesObject, Paths } from "../types";

export type FetchMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface FetchOpts {
  agent: Agent;
  headers?: Record<string, string>;
  method?: FetchMethods;
  body?: string;
}

export interface Filters {
  kindOverride?: GroupVersionKind;
  fields?: Record<string, string>;
  labels?: Record<string, string>;
  name?: string;
  namespace?: string;
}

export type QueryParams = Record<string, string | number | boolean>;

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
};

export type KubeUnfilteredActions<K extends KubernetesObject> = {
  /**
   * Create the provided K8s resource or throw an error if it already exists.
   *
   * @param resource
   * @returns
   */
  Create: (resource: K) => Promise<K>;

  /**
   * Replace the provided K8s resource or throw an error if it doesn't exist.
   *
   * @param resource
   * @returns
   */
  Replace: (resource: K) => Promise<K>;

  /**
   * Patch the provided K8s resource or throw an error if it doesn't exist.
   *
   * @param payload The patch operations or the original and updated resources
   * @returns The patched resource
   */
  Patch: (payload: Operation[] | { original: K; updated: K }) => Promise<K>;

  /**
   * Completely override the resource if it exists, otherwise create it.
   *
   * Note this will delete the resource if it exists and then create it.
   *
   * @param resource The resource to create or replace
   * @returns The created or replaced resource
   */
  CreateOrReplace: (resource: K) => Promise<K>;
};

export type KubeWithFilters<K extends KubernetesObject> = KubeFilteredActions<K> & {
  /**
   * Filter the query by the given field.
   * Note multiple calls to this method will result in an AND condition. e.g.
   *
   * ```ts
   * Kube(a.Deployment)
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
   * Kube(a.Deployment)
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
