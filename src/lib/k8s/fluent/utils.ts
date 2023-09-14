// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubeConfig, PatchUtils } from "@kubernetes/client-node";
import { Agent } from "https";
import type request from "request";

import { packageJSON } from "../../../templates/data.json";
import { fetch } from "../../fetch";
import Log from "../../logger";
import { GenericClass } from "../../types";
import { modelToGroupVersionKind } from "../kinds";
import { FetchMethods, FetchOpts, Filters, QueryParams } from "./types";

/**
 * Build the query parameters for a Kubernetes API request
 *
 * @param filters
 * @returns
 */
export function queryBuilder(filters: Filters): QueryParams {
  const params: QueryParams = {};

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
export async function kubeCfg(path: string) {
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

export async function kubeExec<T extends GenericClass, K>(
  model: T,
  filters: Filters,
  method: FetchMethods,
  payload?: K | unknown,
) {
  const path = pathBuilder(model, filters, method === "POST");
  const { url, opts } = await kubeCfg(path);

  let queryString = "";

  opts.method = method;

  // Add user agent to the request header like kubectl does
  opts.headers = { ...opts.headers, "User-Agent": `pepr.dev/${packageJSON.version}` };

  switch (opts.method) {
    case "PATCH":
      opts.headers["Content-Type"] = PatchUtils.PATCH_FORMAT_JSON_PATCH;
      break;

    case "APPLY":
      opts.headers["Content-Type"] = PatchUtils.PATCH_FORMAT_APPLY_YAML;
      opts.method = "PATCH";
      queryString = `?fieldManager=pepr&fieldValidation=Strict&force=false`;
      break;
  }

  if (payload) {
    opts.body = JSON.stringify(payload);
  }

  const resp = await fetch<K>(url + queryString, opts);

  if (resp.ok) {
    return resp.data;
  }

  Log.debug(`Failed to ${opts.method} ${url + queryString}: ${resp.status} ${resp.statusText}`);
  throw resp;
}
