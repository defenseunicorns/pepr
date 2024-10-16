"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const node_fetch_1 = require("node-fetch");
const fetch_1 = require("../fetch");
const kinds_1 = require("../kinds");
const upstream_1 = require("../upstream");
const utils_1 = require("./utils");
globals_1.jest.mock("https");
globals_1.jest.mock("../fetch");
(0, globals_1.describe)("pathBuilder Function", () => {
    const serverUrl = "https://jest-test:8080";
    (0, globals_1.it)("should throw an error if the kind is not specified and the model is not a KubernetesObject", () => {
        const model = { name: "Unknown" };
        const filters = {};
        (0, globals_1.expect)(() => (0, utils_1.pathBuilder)("", model, filters)).toThrow("Kind not specified for Unknown");
    });
    (0, globals_1.it)("should generate a path with a set-based label selector", () => {
        const filters = {
            namespace: "default",
            name: "mypod",
            labels: { iamalabel: "" },
        };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.Pod, filters);
        const expected = new URL("/api/v1/namespaces/default/pods/mypod?labelSelector=iamalabel", serverUrl);
        (0, globals_1.expect)(result.toString()).toEqual(expected.toString());
    });
    (0, globals_1.it)("should generate a path for core group kinds (with custom filters)", () => {
        const filters = {
            namespace: "default",
            name: "mypod",
            fields: { iamafield: "iamavalue" },
            labels: { iamalabel: "iamalabelvalue" },
        };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.Pod, filters);
        const expected = new URL("/api/v1/namespaces/default/pods/mypod?fieldSelector=iamafield%3Diamavalue&labelSelector=iamalabel%3Diamalabelvalue", serverUrl);
        (0, globals_1.expect)(result.toString()).toEqual(expected.toString());
    });
    (0, globals_1.it)("Version not specified in a Kind", () => {
        const filters = {
            namespace: "default",
            name: "mypod",
        };
        class Fake {
            name;
            constructor() {
                this.name = "Fake";
            }
        }
        (0, kinds_1.RegisterKind)(Fake, {
            kind: "Fake",
            version: "",
            group: "fake",
        });
        try {
            (0, utils_1.pathBuilder)(serverUrl, Fake, filters);
        }
        catch (e) {
            (0, globals_1.expect)(e.message).toEqual(`Version not specified for Fake`);
        }
    });
    (0, globals_1.it)("should generate a path for core group kinds", () => {
        const filters = { namespace: "default", name: "mypod" };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.Pod, filters);
        const expected = new URL("/api/v1/namespaces/default/pods/mypod", serverUrl);
        (0, globals_1.expect)(result).toEqual(expected);
    });
    (0, globals_1.it)("should generate a path for non-core group kinds", () => {
        const filters = {
            namespace: "default",
            name: "myingress",
        };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.Ingress, filters);
        const expected = new URL("/apis/networking.k8s.io/v1/namespaces/default/ingresses/myingress", serverUrl);
        (0, globals_1.expect)(result).toEqual(expected);
    });
    (0, globals_1.it)("should generate a path without a namespace if not provided", () => {
        const filters = { name: "tester" };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.ClusterRole, filters);
        const expected = new URL("/apis/rbac.authorization.k8s.io/v1/clusterroles/tester", serverUrl);
        (0, globals_1.expect)(result).toEqual(expected);
    });
    (0, globals_1.it)("should generate a path without a name if excludeName is true", () => {
        const filters = { namespace: "default", name: "mypod" };
        const result = (0, utils_1.pathBuilder)(serverUrl, upstream_1.Pod, filters, true);
        const expected = new URL("/api/v1/namespaces/default/pods", serverUrl);
        (0, globals_1.expect)(result).toEqual(expected);
    });
});
(0, globals_1.describe)("kubeExec Function", () => {
    const mockedFetch = globals_1.jest.mocked(fetch_1.fetch);
    const fakeFilters = { name: "fake", namespace: "default" };
    const fakeMethod = "GET";
    const fakePayload = {
        metadata: { name: "fake", namespace: "default" },
        status: { phase: "Ready" },
    };
    const fakeUrl = new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake");
    const fakeOpts = {
        body: JSON.stringify(fakePayload),
        compress: true,
        headers: new node_fetch_1.Headers({
            "Content-Type": "application/json",
            "User-Agent": `kubernetes-fluent-client`,
        }),
        method: fakeMethod,
    };
    (0, globals_1.beforeEach)(() => {
        mockedFetch.mockClear();
    });
    (0, globals_1.it)("should make a successful fetch call", async () => {
        mockedFetch.mockResolvedValueOnce({
            ok: true,
            data: fakePayload,
            status: 200,
            statusText: "OK",
        });
        const result = await (0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, fakeMethod, fakePayload);
        (0, globals_1.expect)(result).toEqual(fakePayload);
        (0, globals_1.expect)(mockedFetch).toHaveBeenCalledWith(fakeUrl, globals_1.expect.objectContaining(fakeOpts));
    });
    (0, globals_1.it)("should handle PATCH_STATUS", async () => {
        mockedFetch.mockResolvedValueOnce({
            ok: true,
            data: fakePayload,
            status: 200,
            statusText: "OK",
        });
        const result = await (0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, "PATCH_STATUS", fakePayload);
        (0, globals_1.expect)(result).toEqual(fakePayload);
        (0, globals_1.expect)(mockedFetch).toHaveBeenCalledWith(new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake/status"), globals_1.expect.objectContaining({
            method: "PATCH",
            compress: true,
            headers: new node_fetch_1.Headers({
                "Content-Type": "application/merge-patch+json",
                "User-Agent": `kubernetes-fluent-client`,
            }),
            body: JSON.stringify({ status: fakePayload.status }),
        }));
    });
    (0, globals_1.it)("should handle PATCH", async () => {
        mockedFetch.mockResolvedValueOnce({
            ok: true,
            data: fakePayload,
            status: 200,
            statusText: "OK",
        });
        const patchPayload = [{ op: "replace", path: "/status/phase", value: "Ready" }];
        const result = await (0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, "PATCH", patchPayload);
        (0, globals_1.expect)(result).toEqual(fakePayload);
        (0, globals_1.expect)(mockedFetch).toHaveBeenCalledWith(new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake"), globals_1.expect.objectContaining({
            method: "PATCH",
            compress: true,
            headers: new node_fetch_1.Headers({
                "Content-Type": "application/json-patch+json",
                "User-Agent": `kubernetes-fluent-client`,
            }),
            body: JSON.stringify(patchPayload),
        }));
    });
    (0, globals_1.it)("should handle APPLY", async () => {
        mockedFetch.mockResolvedValueOnce({
            ok: true,
            data: fakePayload,
            status: 200,
            statusText: "OK",
        });
        const result = await (0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, "APPLY", fakePayload);
        (0, globals_1.expect)(result).toEqual(fakePayload);
        (0, globals_1.expect)(mockedFetch).toHaveBeenCalledWith(new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake?fieldManager=pepr&fieldValidation=Strict&force=false"), globals_1.expect.objectContaining({
            method: "PATCH",
            compress: true,
            headers: new node_fetch_1.Headers({
                "Content-Type": "application/apply-patch+yaml",
                "User-Agent": `kubernetes-fluent-client`,
            }),
            body: JSON.stringify(fakePayload),
        }));
    });
    (0, globals_1.it)("should handle APPLY with force", async () => {
        mockedFetch.mockResolvedValueOnce({
            ok: true,
            data: fakePayload,
            status: 200,
            statusText: "OK",
        });
        const result = await (0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, "APPLY", fakePayload, { force: true });
        (0, globals_1.expect)(result).toEqual(fakePayload);
        (0, globals_1.expect)(mockedFetch).toHaveBeenCalledWith(new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake?fieldManager=pepr&fieldValidation=Strict&force=true"), globals_1.expect.objectContaining({
            method: "PATCH",
            compress: true,
            headers: new node_fetch_1.Headers({
                "Content-Type": "application/apply-patch+yaml",
                "User-Agent": `kubernetes-fluent-client`,
            }),
            body: JSON.stringify(fakePayload),
        }));
    });
    (0, globals_1.it)("should handle fetch call failure", async () => {
        const fakeStatus = 404;
        const fakeStatusText = "Not Found";
        mockedFetch.mockResolvedValueOnce({
            ok: false,
            data: null,
            status: fakeStatus,
            statusText: fakeStatusText,
        });
        await (0, globals_1.expect)((0, utils_1.k8sExec)(upstream_1.Pod, fakeFilters, fakeMethod, fakePayload)).rejects.toEqual(globals_1.expect.objectContaining({
            status: fakeStatus,
            statusText: fakeStatusText,
        }));
    });
});
