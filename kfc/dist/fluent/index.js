"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.K8s = K8s;
const http_status_codes_1 = require("http-status-codes");
const fetch_1 = require("../fetch");
const kinds_1 = require("../kinds");
const utils_1 = require("./utils");
const watch_1 = require("./watch");
const helpers_1 = require("../helpers");
const upstream_1 = require("../upstream");
/**
 * Kubernetes fluent API inspired by Kubectl. Pass in a model, then call filters and actions on it.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @returns a fluent API for the model
 */
function K8s(model, filters = {}) {
    const withFilters = { WithField, WithLabel, Get, Delete, Watch, Logs };
    const matchedKind = filters.kindOverride || (0, kinds_1.modelToGroupVersionKind)(model.name);
    /**
     * @inheritdoc
     * @see {@link K8sInit.InNamespace}
     */
    function InNamespace(namespace) {
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
    function WithField(key, value) {
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
    function WithLabel(key, value = "") {
        filters.labels = filters.labels || {};
        filters.labels[key] = value;
        return withFilters;
    }
    /**
     * Sync the filters with the provided payload.
     *
     * @param payload - the payload to sync with
     */
    function syncFilters(payload) {
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
    /**
     * @inheritdoc
     * @see {@link K8sInit.Logs}
     */
    async function Logs(name) {
        let labels = {};
        const { kind } = matchedKind;
        const { namespace } = filters;
        const podList = [];
        if (name) {
            if (filters.name) {
                throw new Error(`Name already specified: ${filters.name}`);
            }
            filters.name = name;
        }
        if (!namespace) {
            throw new Error("Namespace must be defined");
        }
        if (!(0, helpers_1.hasLogs)(kind)) {
            throw new Error("Kind must be Pod or have a selector");
        }
        try {
            const object = await (0, utils_1.k8sExec)(model, filters, "GET");
            if (kind !== "Pod") {
                if (kind === "Service") {
                    const svc = object;
                    labels = svc.spec.selector ?? {};
                }
                else if (kind === "ReplicaSet" ||
                    kind === "Deployment" ||
                    kind === "StatefulSet" ||
                    kind === "DaemonSet") {
                    const rs = object;
                    labels = rs.spec.selector.matchLabels ?? {};
                }
                const list = await K8s(upstream_1.Pod, { namespace: filters.namespace, labels }).Get();
                list.items.forEach(item => {
                    return podList.push(item);
                });
            }
            else {
                podList.push(object);
            }
        }
        catch {
            throw new Error(`Failed to get logs in KFC Logs function`);
        }
        const podModel = { ...model, name: "V1Pod" };
        const logPromises = podList.map(po => (0, utils_1.k8sExec)(podModel, { ...filters, name: po.metadata.name }, "LOG"));
        const responses = await Promise.all(logPromises);
        const combinedString = responses.reduce((accumulator, currentString, i) => {
            const prefixedLines = currentString
                .split("\n")
                .map(line => {
                return line !== "" ? `[pod/${podList[i].metadata.name}] ${line}` : "";
            })
                .filter(str => str !== "");
            return [...accumulator, ...prefixedLines];
        }, []);
        return combinedString;
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Get}
     */
    async function Get(name) {
        if (name) {
            if (filters.name) {
                throw new Error(`Name already specified: ${filters.name}`);
            }
            filters.name = name;
        }
        return (0, utils_1.k8sExec)(model, filters, "GET");
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Delete}
     */
    async function Delete(filter) {
        if (typeof filter === "string") {
            filters.name = filter;
        }
        else if (filter) {
            syncFilters(filter);
        }
        try {
            // Try to delete the resource
            await (0, utils_1.k8sExec)(model, filters, "DELETE");
        }
        catch (e) {
            // If the resource doesn't exist, ignore the error
            if (e.status === http_status_codes_1.StatusCodes.NOT_FOUND) {
                return;
            }
            throw e;
        }
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Apply}
     */
    async function Apply(resource, applyCfg = { force: false }) {
        syncFilters(resource);
        return (0, utils_1.k8sExec)(model, filters, "APPLY", resource, applyCfg);
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Create}
     */
    async function Create(resource) {
        syncFilters(resource);
        return (0, utils_1.k8sExec)(model, filters, "POST", resource);
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Patch}
     */
    async function Patch(payload) {
        // If there are no operations, throw an error
        if (payload.length < 1) {
            throw new Error("No operations specified");
        }
        return (0, utils_1.k8sExec)(model, filters, "PATCH", payload);
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.PatchStatus}
     */
    async function PatchStatus(resource) {
        syncFilters(resource);
        return (0, utils_1.k8sExec)(model, filters, "PATCH_STATUS", resource);
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Watch}
     */
    function Watch(callback, watchCfg) {
        return new watch_1.Watcher(model, filters, callback, watchCfg);
    }
    /**
     * @inheritdoc
     * @see {@link K8sInit.Raw}
     */
    async function Raw(url, method = "GET") {
        const thing = await (0, utils_1.k8sCfg)(method);
        const { opts, serverUrl } = thing;
        const resp = await (0, fetch_1.fetch)(`${serverUrl}${url}`, opts);
        if (resp.ok) {
            return resp.data;
        }
        throw resp;
    }
    return { InNamespace, Apply, Create, Patch, PatchStatus, Raw, ...withFilters };
}
