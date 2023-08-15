// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubeConfig, PatchUtils } from "@kubernetes/client-node";
import { Operation, compare } from "fast-json-patch";
import type request from "request";

import { StatusCodes } from "http-status-codes";
import { Agent } from "https";
import { fetch } from "../fetch";
import Log from "../logger";
import { GenericClass } from "../types";
import { modelToGroupVersionKind } from "./kinds";
import { GroupVersionKind, KubernetesListObject, KubernetesObject } from "./types";

type FetchMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface FetchOpts {
  agent: Agent;
  headers?: Record<string, string>;
  method?: FetchMethods;
  body?: string;
}

export interface Filters {
  kindOverride?: GroupVersionKind;
  annotations?: Record<string, string>;
  fields?: Record<string, string>;
  labels?: Record<string, string>;
  name?: string;
  namespace?: string;
}

export type QueryParams = Record<string, string | number | boolean>;

/**
 * Build the query parameters for a Kubernetes API request
 *
 * @param filters
 * @returns
 */
export function queryBuilder(filters: Filters): QueryParams {
  const params: QueryParams = {};

  if (filters.annotations) {
    params.labelSelector = Object.entries(filters.annotations)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }

  if (filters.fields) {
    params.fieldSelector = Object.entries(filters.fields)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }

  if (filters.labels) {
    params.labelSelector = Object.entries(filters.labels)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }

  return params;
}

/**
 * Generate a path to a Kubernetes resource
 *
 * @param model
 * @param opts
 * @returns
 */
export function pathBuilder<T extends GenericClass>(model: T, opts: Filters, excludeName = false) {
  const matchedKind = opts.kindOverride || modelToGroupVersionKind(model.name);

  // If the kind is not specified and the model is not a KubernetesObject, throw an error
  if (!matchedKind) {
    throw new Error(`Kind not specified for ${model.name}`);
  }

  // Use the plural property if it exists, otherwise use lowercase kind + s
  const plural = matchedKind.plural || `${matchedKind.kind.toLowerCase()}s`;

  let base = "/api/v1";

  // If the kind is not in the core group, add the group and version to the path
  if (matchedKind.group) {
    if (!matchedKind.version) {
      throw new Error(`Version not specified for ${model.name}`);
    }

    base = `/apis/${matchedKind.group}/${matchedKind.version}`;
  }

  // Namespaced paths require a namespace prefix
  const namespace = opts.namespace ? `namespaces/${opts.namespace}` : "";

  // Name should not be included in some paths
  const name = excludeName ? "" : opts.name;

  // Build the complete path to the resource
  const path = [base, namespace, plural, name].filter(Boolean).join("/");

  return path;
}

export function Kube<T extends GenericClass, K extends KubernetesObject = InstanceType<T>>(
  model: T,
  filters: Filters = {},
) {
  const filterActions = { Get, Delete };
  const unfilteredActions = { Create, CreateOrReplace, Patch, Replace };
  const withFilters = { WithAnnotation, WithField, WithLabel, ...filterActions };

  function InNamespace(namespaces: string) {
    if (filters.namespace) {
      throw new Error(`Namespace already specified: ${filters.namespace}`);
    }

    filters.namespace = namespaces;
    return withFilters;
  }

  function WithAnnotation(key: string, value = "") {
    filters.annotations = filters.annotations || {};
    filters.annotations[key] = value;
    return withFilters;
  }

  function WithField(key: string, value = "") {
    filters.fields = filters.fields || {};
    filters.fields[key] = value;
    return withFilters;
  }

  function WithLabel(key: string, value = "") {
    filters.labels = filters.labels || {};
    filters.labels[key] = value;
    return withFilters;
  }

  function syncFilters(payload: K) {
    if (!filters.namespace) {
      filters.namespace = payload.metadata?.namespace;
    }

    if (!filters.name) {
      filters.name = payload.metadata?.name;
    }
  }

  async function kubeExec<R = K>(model: T, filters: Filters, method: FetchMethods, payload?: K) {
    const path = pathBuilder(model, filters, method === "POST");
    const { url, opts } = await kubeCfg(path);

    opts.method = method;

    if (payload) {
      opts.body = JSON.stringify(payload);
    }

    const resp = await fetch<R>(url, opts);

    if (resp.ok) {
      return resp.data;
    }

    Log.debug(`Failed to ${method} ${url}: ${resp.status} ${resp.statusText}`);
    throw resp;
  }

  async function Get(): Promise<KubernetesListObject<K>>;
  async function Get(name: string): Promise<K>;
  async function Get(name?: string) {
    if (name) {
      if (filters.name) {
        throw new Error(`Name already specified: ${filters.name}`);
      }
      filters.name = name;
    }

    return kubeExec<K | KubernetesListObject<K>>(model, filters, "GET");
  }

  /**
   * Create the provided K8s resource or throw an error if it already exists.
   *
   * @param resource
   * @returns
   */
  async function Create(resource: K): Promise<K> {
    syncFilters(resource);
    return kubeExec(model, filters, "POST", resource);
  }

  /**
   * Delete the resource if it exists.
   *
   * @param filter - the resource or resource name to delete
   */
  async function Delete(filter: K | string): Promise<void> {
    if (typeof filter === "string") {
      filters.name = filter;
    } else {
      syncFilters(filter);
    }

    try {
      // Try to delete the resource
      await kubeExec<void>(model, filters, "DELETE");
    } catch (e) {
      // If the resource doesn't exist, ignore the error
      if (e.status === StatusCodes.NOT_FOUND) {
        return;
      }

      throw e;
    }
  }

  /**
   * Replace the provided K8s resource or throw an error if it doesn't exist.
   *
   * @param resource
   * @returns
   */
  async function Replace(resource: K): Promise<K> {
    syncFilters(resource);
    return kubeExec(model, filters, "PUT", resource);
  }

  /**
   * Patch the provided K8s resource or throw an error if it doesn't exist.
   *
   * @param payload The patch operations or the original and updated resources
   * @returns The patched resource
   */
  async function Patch(payload: Operation[] | { original: K; updated: K }): Promise<K> {
    const isPatchOps = Array.isArray(payload);

    // If this is not a patch operation, sync the filters from the original resource
    if (!isPatchOps) {
      syncFilters(payload.original);
    }

    const path = pathBuilder(model, filters);
    const { url, opts } = await kubeCfg(path);

    opts.headers = opts.headers || {};
    opts.headers["Content-Type"] = PatchUtils.PATCH_FORMAT_JSON_PATCH;
    opts.method = "PATCH";

    let operations: Operation[];

    // If the payload is an array, assume it's a list of operations
    if (Array.isArray(payload)) {
      operations = payload;
    } else {
      // Otherwise, generate the operations from the original and updated resources
      operations = compare(payload.original, payload.updated);
    }

    // If there are no operations, throw an error
    if (operations.length < 1) {
      throw new Error("No operations specified");
    }

    // Add the operations to the request body
    opts.body = JSON.stringify(payload);

    const resp = await fetch<K>(url, opts);

    if (resp.ok) {
      return resp.data;
    }

    throw new Error(`Failed to PATCH ${url}: ${resp.status} ${resp.statusText}`);
  }

  /**
   * Completely override the resource if it exists, otherwise create it.
   *
   * Note this will delete the resource if it exists and then create it.
   *
   * @param resource The resource to create or replace
   * @returns The created or replaced resource
   */
  async function CreateOrReplace(resource: K): Promise<K> {
    try {
      // First try to create the resource
      const resp = await Create(resource);
      return resp;
    } catch (e) {
      // If the resource already exists, delete it and try again
      if (e.status === StatusCodes.CONFLICT) {
        Log.info("Resource already exists, deleting and re-creating");
        await Delete(resource);
        return Create(resource);
      }

      // Otherwise, something else went wrong, re-throw the error
      throw e;
    }
  }

  return { InNamespace, ...withFilters, ...unfilteredActions };
}

/**
 * Sets up the kubeconfig and https agent for a request
 *
 * A few notes:
 * - The kubeconfig is loaded from the default location, and can check for in-cluster config
 * - We have to create an agent to handle the TLS connection (for the custom CA + mTLS in some cases)
 * - The K8s lib uses request instead of node-fetch today so the object is slightly different
 *
 * @param path
 * @returns
 */
async function kubeCfg(path: string) {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();

  const cluster = kubeConfig.getCurrentCluster();
  if (!cluster) {
    throw new Error("No currently active cluster");
  }

  // Create the empty options object for the k8s lib
  const k8sOpts: request.Options = {
    headers: {
      // Set the default content type to JSON
      "Content-Type": "application/json",
    },
    url: cluster.server + path,
  };

  // Setup the TLS options & auth headers, as needed
  await kubeConfig.applyToRequest(k8sOpts);

  // Create the tlS agent for the request
  const agent = new Agent(k8sOpts);

  const { headers, url } = k8sOpts;
  const opts: FetchOpts = { agent, headers };

  return { url, opts };
}
