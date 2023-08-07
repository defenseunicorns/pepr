// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubeConfig, PatchUtils } from "@kubernetes/client-node";
import { Operation } from "fast-json-patch";

import { StatusCodes } from "http-status-codes";
import { Agent, AgentOptions } from "https";
import { fetch } from "../fetch";
import Log from "../logger";
import { GenericClass } from "../types";
import { modelToGroupVersionKind } from "./kinds";
import { GroupVersionKind, KubernetesObject } from "./types";

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
export function pathBuilder<T extends GenericClass>(model: T, opts: Filters, isCreate = false) {
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

  // Create operations don't have a name in the path
  const name = isCreate ? "" : opts.name;

  // Build the complete path to the resource
  const path = [base, namespace, plural, name].filter(Boolean).join("/");

  return path;
}

export function Kube<T extends GenericClass, K extends KubernetesObject = InstanceType<T>>(
  model: T,
  filters: Filters = {},
) {
  const actions = { Get, Create, Delete, Replace, CreateOrReplace, Patch };
  const withFilters = { WithAnnotation, WithField, WithLabel, WithName, ...actions };

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

  function WithName(name: string) {
    if (filters.name) {
      throw new Error(`Name already specified: ${filters.name}`);
    }

    filters.name = name;
    return actions;
  }

  function syncFilters(payload: K) {
    if (!filters.namespace) {
      filters.namespace = payload.metadata?.namespace;
    }

    if (!filters.name) {
      filters.name = payload.metadata?.name;
    }
  }

  async function kubeExec<R = K>(model: T, filters: Filters, method: "GET" | "POST" | "PUT" | "DELETE", payload?: K) {
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

  async function Get(): Promise<K | K[]> {
    return kubeExec<K | K[]>(model, filters, "GET");
  }

  async function Create(payload: K): Promise<K> {
    syncFilters(payload);
    return kubeExec(model, filters, "POST", payload);
  }

  async function Delete(payload?: K): Promise<void> {
    if (payload) {
      syncFilters(payload);
    }
    return kubeExec<void>(model, filters, "DELETE");
  }

  async function Replace(payload: K): Promise<K> {
    syncFilters(payload);
    return kubeExec(model, filters, "PUT", payload);
  }

  async function Patch(payload: Operation[]): Promise<K> {
    const path = pathBuilder(model, filters);
    const { url, opts } = await kubeCfg(path);

    opts.headers["Content-Type"] = PatchUtils.PATCH_FORMAT_JSON_PATCH;
    opts.method = "PATCH";

    if (payload) {
      opts.body = JSON.stringify(payload);
    }

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
   * @param payload
   * @returns
   */
  async function CreateOrReplace(payload: K): Promise<K> {
    try {
      // First try to create the resource
      const resp = await Create(payload);
      return resp;
    } catch (e) {
      // If the resource already exists, delete it and try again
      if (e.status === StatusCodes.CONFLICT) {
        Log.info("Resource already exists, deleting and re-creating");
        await Delete(payload);
        return Create(payload);
      }

      // Otherwise, something else went wrong, re-throw the error
      throw e;
    }
  }

  return { InNamespace, ...withFilters };
}

async function kubeCfg(path: string) {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();

  const cluster = kubeConfig.getCurrentCluster();
  if (!cluster) {
    throw new Error("No currently active cluster");
  }

  const agentOpts: AgentOptions = {};
  await kubeConfig.applyToRequest(agentOpts as { url: string });

  const agent = new Agent(agentOpts);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const url = cluster.server + path;
  const method = "GET";
  const body = "";

  return { url, opts: { agent, headers, method, body } };
}
