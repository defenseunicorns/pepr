// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation, compare } from "fast-json-patch";
import { StatusCodes } from "http-status-codes";

import { GenericClass } from "../../types";
import { modelToGroupVersionKind } from "../kinds";
import { KubernetesListObject, KubernetesObject, Paths } from "../types";
import { Filters, KubeInit } from "./types";
import { kubeExec } from "./utils";

/**
 * Kubernetes fluent API inspired by Kubectl. Pass in a model, then call filters and actions on it.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 */
export function Kube<T extends GenericClass, K extends KubernetesObject = InstanceType<T>>(
  model: T,
  filters: Filters = {},
): KubeInit<K> {
  const withFilters = { WithField, WithLabel, Get, Delete };
  const matchedKind = filters.kindOverride || modelToGroupVersionKind(model.name);

  function InNamespace(namespaces: string) {
    if (filters.namespace) {
      throw new Error(`Namespace already specified: ${filters.namespace}`);
    }

    filters.namespace = namespaces;
    return withFilters;
  }

  function WithField<P extends Paths<K>>(key: P, value = "") {
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
    // Ensure the payload has metadata
    payload.metadata = payload.metadata || {};

    if (!filters.namespace) {
      filters.namespace = payload.metadata.namespace;
    }

    if (!filters.name) {
      filters.name = payload.metadata.name;
    }

    payload.apiVersion = payload.apiVersion || matchedKind.version;
    payload.kind = payload.kind || matchedKind.kind;
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

    return kubeExec<T, K | KubernetesListObject<K>>(model, filters, "GET");
  }

  async function Delete(filter?: K | string): Promise<void> {
    if (typeof filter === "string") {
      filters.name = filter;
    } else if (filter) {
      syncFilters(filter);
    }

    try {
      // Try to delete the resource
      await kubeExec<T, void>(model, filters, "DELETE");
    } catch (e) {
      // If the resource doesn't exist, ignore the error
      if (e.status === StatusCodes.NOT_FOUND) {
        return;
      }

      throw e;
    }
  }

  async function Apply(resource: K): Promise<K> {
    syncFilters(resource);
    return kubeExec(model, filters, "APPLY", resource);
  }

  async function Create(resource: K): Promise<K> {
    syncFilters(resource);
    return kubeExec(model, filters, "POST", resource);
  }

  async function Patch(payload: Operation[] | { original: K; updated: K }): Promise<K> {
    const isPatchOps = Array.isArray(payload);

    let operations: Operation[];

    // If the payload is an array, assume it's a list of operations
    if (isPatchOps) {
      operations = payload;
    } else {
      // Otherwise, generate the operations from the original and updated resources
      operations = compare(payload.original, payload.updated);

      // Also sync the filters from the original resource
      syncFilters(payload.original);
    }

    // If there are no operations, throw an error
    if (operations.length < 1) {
      throw new Error("No operations specified");
    }

    return kubeExec<T, K>(model, filters, "PATCH", operations);
  }

  return { InNamespace, Apply, Create, Patch, ...withFilters };
}
