// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { KubeConfig, PatchStrategy } from "@kubernetes/client-node";
import { Headers } from "node-fetch";
import { URL } from "url";

import { fetch } from "../fetch";
import { modelToGroupVersionKind } from "../kinds";
import { GenericClass } from "../types";
import { ApplyCfg, FetchMethods, Filters } from "./types";

const SSA_CONTENT_TYPE = "application/apply-patch+yaml";

/**
 * Generate a path to a Kubernetes resource
 *
 * @param serverUrl - the URL of the Kubernetes API server
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @param excludeName - (optional) exclude the name from the path
 * @returns the path to the resource
 */
export function pathBuilder<T extends GenericClass>(
  serverUrl: string,
  model: T,
  filters: Filters,
  excludeName = false,
) {
  const matchedKind = filters.kindOverride || modelToGroupVersionKind(model.name);

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
  const namespace = filters.namespace ? `namespaces/${filters.namespace}` : "";

  // Name should not be included in some paths
  const name = excludeName ? "" : filters.name;

  // Build the complete path to the resource
  const path = [base, namespace, plural, name].filter(Boolean).join("/");

  // Generate the URL object
  const url = new URL(path, serverUrl);

  // Add field selectors to the query params
  if (filters.fields) {
    const fieldSelector = Object.entries(filters.fields)
      .map(([key, value]) => `${key}=${value}`)
      .join(",");

    url.searchParams.set("fieldSelector", fieldSelector);
  }

  // Add label selectors to the query params
  if (filters.labels) {
    const labelSelector = Object.entries(filters.labels)
      // Exists set-based operators only include the key
      // See https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#set-based-requirement
      .map(([key, value]) => (value ? `${key}=${value}` : key))
      .join(",");

    url.searchParams.set("labelSelector", labelSelector);
  }

  return url;
}

/**
 * Sets up the kubeconfig and https agent for a request
 *
 * A few notes:
 * - The kubeconfig is loaded from the default location, and can check for in-cluster config
 * - We have to create an agent to handle the TLS connection (for the custom CA + mTLS in some cases)
 * - The K8s lib uses request instead of node-fetch today so the object is slightly different
 *
 * @param method - the HTTP method to use
 * @returns the fetch options and server URL
 */
export async function k8sCfg(method: FetchMethods) {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();

  const cluster = kubeConfig.getCurrentCluster();
  if (!cluster) {
    throw new Error("No currently active cluster");
  }

  // Setup the TLS options & auth headers, as needed
  const opts = await kubeConfig.applyToFetchOptions({
    method,
    headers: {
      // Set the default content type to JSON
      "Content-Type": "application/json",
      // Set the user agent like kubectl does
      "User-Agent": `kubernetes-fluent-client`,
    },
  });

  // Enable compression
  opts.compress = true;

  return { opts, serverUrl: cluster.server };
}

/**
 * Execute a request against the Kubernetes API server.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @param method - the HTTP method to use
 * @param payload - (optional) the payload to send
 * @param applyCfg - (optional) configuration for the apply method
 *
 * @returns the parsed JSON response
 */
export async function k8sExec<T extends GenericClass, K>(
  model: T,
  filters: Filters,
  method: FetchMethods,
  payload?: K | unknown,
  applyCfg: ApplyCfg = { force: false },
) {
  const reconstruct = async (method: FetchMethods) => {
    const configMethod = method === "LOG" ? "GET" : method;
    const { opts, serverUrl } = await k8sCfg(configMethod);
    const isPost = method === "POST";
    const baseUrl = pathBuilder(serverUrl, model, filters, isPost);
    if (method === "LOG") {
      baseUrl.pathname = `${baseUrl.pathname}/log`;
    }
    return {
      url: baseUrl,
      opts,
    };
  };

  const { opts, url } = await reconstruct(method);

  switch (opts.method) {
    // PATCH_STATUS is a special case that uses the PATCH method on status subresources
    case "PATCH_STATUS":
      opts.method = "PATCH";
      url.pathname = `${url.pathname}/status`;
      (opts.headers as Headers).set("Content-Type", PatchStrategy.MergePatch);
      payload = { status: (payload as { status: unknown }).status };
      break;

    case "PATCH":
      (opts.headers as Headers).set("Content-Type", PatchStrategy.JsonPatch);
      break;

    case "APPLY":
      (opts.headers as Headers).set("Content-Type", SSA_CONTENT_TYPE);
      opts.method = "PATCH";
      url.searchParams.set("fieldManager", "pepr");
      url.searchParams.set("fieldValidation", "Strict");
      url.searchParams.set("force", applyCfg.force ? "true" : "false");
      break;
  }

  if (payload) {
    opts.body = JSON.stringify(payload);
  }

  const resp = await fetch<K>(url, opts);

  if (resp.ok) {
    return resp.data;
  }

  if (resp.status === 404 && method === "PATCH_STATUS") {
    resp.statusText =
      "Not Found" + " (NOTE: This error is expected if the resource has no status subresource)";
  }

  throw resp;
}
