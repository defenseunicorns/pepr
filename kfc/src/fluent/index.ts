// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { KubernetesListObject, KubernetesObject } from "@kubernetes/client-node";
import { Operation } from "fast-json-patch";
import { StatusCodes } from "http-status-codes";
import type { PartialDeep } from "type-fest";

import { fetch } from "../fetch";
import { modelToGroupVersionKind } from "../kinds";
import { GenericClass } from "../types";
import { ApplyCfg, FetchMethods, Filters, K8sInit, Paths, WatchAction } from "./types";
import { k8sCfg, k8sExec } from "./utils";
import { WatchCfg, Watcher } from "./watch";
import { hasLogs } from "../helpers";
import { Pod, type Service, type ReplicaSet } from "../upstream";
/**
 * Kubernetes fluent API inspired by Kubectl. Pass in a model, then call filters and actions on it.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @returns a fluent API for the model
 */
export function K8s<T extends GenericClass, K extends KubernetesObject = InstanceType<T>>(
  model: T,
  filters: Filters = {},
): K8sInit<T, K> {
  const withFilters = { WithField, WithLabel, Get, Delete, Watch, Logs };
  const matchedKind = filters.kindOverride || modelToGroupVersionKind(model.name);

  /**
   * @inheritdoc
   * @see {@link K8sInit.InNamespace}
   */
  function InNamespace(namespace: string) {
    if (filters.namespace) {
      throw new Error(`Namespace already specified: ${filters.namespace}`);
    }

    filters.namespace = namespace;
    return withFilters;
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.WithField}
   */
  function WithField<P extends Paths<K>>(key: P, value: string) {
    filters.fields = filters.fields || {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    filters.fields[key] = value;
    return withFilters;
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.WithLabel}
   */
  function WithLabel(key: string, value = "") {
    filters.labels = filters.labels || {};
    filters.labels[key] = value;
    return withFilters;
  }

  /**
   * Sync the filters with the provided payload.
   *
   * @param payload - the payload to sync with
   */
  function syncFilters(payload: K) {
    // Ensure the payload has metadata
    payload.metadata = payload.metadata || {};

    if (!filters.namespace) {
      filters.namespace = payload.metadata.namespace;
    }

    if (!filters.name) {
      filters.name = payload.metadata.name;
    }

    if (!payload.apiVersion) {
      payload.apiVersion = [matchedKind.group, matchedKind.version].filter(Boolean).join("/");
    }

    if (!payload.kind) {
      payload.kind = matchedKind.kind;
    }
  }
  async function Logs(name?: string): Promise<string[]>;
  /**
   * @inheritdoc
   * @see {@link K8sInit.Logs}
   */
  async function Logs(name?: string): Promise<string[]> {
    let labels: Record<string, string> = {};
    const { kind } = matchedKind;
    const { namespace } = filters;
    const podList: K[] = [];

    if (name) {
      if (filters.name) {
        throw new Error(`Name already specified: ${filters.name}`);
      }
      filters.name = name;
    }

    if (!namespace) {
      throw new Error("Namespace must be defined");
    }
    if (!hasLogs(kind)) {
      throw new Error("Kind must be Pod or have a selector");
    }

    try {
      const object = await k8sExec<T, K>(model, filters, "GET");

      if (kind !== "Pod") {
        if (kind === "Service") {
          const svc: InstanceType<typeof Service> = object;
          labels = svc.spec!.selector ?? {};
        } else if (
          kind === "ReplicaSet" ||
          kind === "Deployment" ||
          kind === "StatefulSet" ||
          kind === "DaemonSet"
        ) {
          const rs: InstanceType<typeof ReplicaSet> = object;
          labels = rs.spec!.selector.matchLabels ?? {};
        }

        const list = await K8s(Pod, { namespace: filters.namespace, labels }).Get();

        list.items.forEach(item => {
          return podList.push(item as unknown as K);
        });
      } else {
        podList.push(object);
      }
    } catch {
      throw new Error(`Failed to get logs in KFC Logs function`);
    }

    const podModel = { ...model, name: "V1Pod" };
    const logPromises = podList.map(po =>
      k8sExec<T, string>(podModel, { ...filters, name: po.metadata!.name! }, "LOG"),
    );

    const responses = await Promise.all(logPromises);

    const combinedString = responses.reduce(
      (accumulator: string[], currentString: string, i: number) => {
        const prefixedLines = currentString
          .split("\n")
          .map(line => {
            return line !== "" ? `[pod/${podList[i].metadata!.name!}] ${line}` : "";
          })
          .filter(str => str !== "");

        return [...accumulator, ...prefixedLines];
      },
      [],
    );

    return combinedString;
  }
  async function Get(): Promise<KubernetesListObject<K>>;
  async function Get(name: string): Promise<K>;
  /**
   * @inheritdoc
   * @see {@link K8sInit.Get}
   */
  async function Get(name?: string) {
    if (name) {
      if (filters.name) {
        throw new Error(`Name already specified: ${filters.name}`);
      }
      filters.name = name;
    }

    return k8sExec<T, K | KubernetesListObject<K>>(model, filters, "GET");
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Delete}
   */
  async function Delete(filter?: K | string): Promise<void> {
    if (typeof filter === "string") {
      filters.name = filter;
    } else if (filter) {
      syncFilters(filter);
    }

    try {
      // Try to delete the resource
      await k8sExec<T, void>(model, filters, "DELETE");
    } catch (e) {
      // If the resource doesn't exist, ignore the error
      if (e.status === StatusCodes.NOT_FOUND) {
        return;
      }

      throw e;
    }
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Apply}
   */
  async function Apply(
    resource: PartialDeep<K>,
    applyCfg: ApplyCfg = { force: false },
  ): Promise<K> {
    syncFilters(resource as K);
    return k8sExec(model, filters, "APPLY", resource, applyCfg);
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Create}
   */
  async function Create(resource: K): Promise<K> {
    syncFilters(resource);
    return k8sExec(model, filters, "POST", resource);
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Patch}
   */
  async function Patch(payload: Operation[]): Promise<K> {
    // If there are no operations, throw an error
    if (payload.length < 1) {
      throw new Error("No operations specified");
    }

    return k8sExec(model, filters, "PATCH", payload);
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.PatchStatus}
   */
  async function PatchStatus(resource: PartialDeep<K>): Promise<K> {
    syncFilters(resource as K);
    return k8sExec(model, filters, "PATCH_STATUS", resource);
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Watch}
   */
  function Watch(callback: WatchAction<T>, watchCfg?: WatchCfg) {
    return new Watcher(model, filters, callback, watchCfg);
  }

  /**
   * @inheritdoc
   * @see {@link K8sInit.Raw}
   */
  async function Raw(url: string, method: FetchMethods = "GET") {
    const thing = await k8sCfg(method);
    const { opts, serverUrl } = thing;
    const resp = await fetch<K>(`${serverUrl}${url}`, opts);

    if (resp.ok) {
      return resp.data;
    }

    throw resp;
  }

  return { InNamespace, Apply, Create, Patch, PatchStatus, Raw, ...withFilters };
}
