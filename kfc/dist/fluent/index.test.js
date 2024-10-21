"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const client_node_1 = require("@kubernetes/client-node");
const _1 = require(".");
const fetch_1 = require("../fetch");
const upstream_1 = require("../upstream");
const utils_1 = require("./utils");
// Setup mocks
globals_1.jest.mock("./utils");
globals_1.jest.mock("../fetch");
const generateFakePodManagedFields = (manager) => {
    return [
        {
            apiVersion: "v1",
            fieldsType: "FieldsV1",
            fieldsV1: {
                "f:metadata": {
                    "f:labels": {
                        "f:fake": {},
                    },
                    "f:spec": {
                        "f:containers": {
                            'k:{"name":"fake"}': {
                                "f:image": {},
                                "f:name": {},
                                "f:resources": {
                                    "f:limits": {
                                        "f:cpu": {},
                                        "f:memory": {},
                                    },
                                    "f:requests": {
                                        "f:cpu": {},
                                        "f:memory": {},
                                    },
                                },
                            },
                        },
                    },
                },
            },
            manager: manager,
            operation: "Apply",
        },
    ];
};
(0, globals_1.describe)("Kube", () => {
    const fakeResource = {
        metadata: {
            name: "fake",
            namespace: "default",
            managedFields: generateFakePodManagedFields("pepr"),
        },
    };
    const mockedKubeCfg = globals_1.jest.mocked(utils_1.k8sCfg);
    const mockedKubeExec = globals_1.jest.mocked(utils_1.k8sExec).mockResolvedValue(fakeResource);
    (0, globals_1.beforeEach)(() => {
        // Clear all instances and calls to constructor and all methods:
        mockedKubeExec.mockClear();
    });
    (0, globals_1.it)("should create a resource", async () => {
        const result = await (0, _1.K8s)(upstream_1.Pod).Create(fakeResource);
        (0, globals_1.expect)(result).toEqual(fakeResource);
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            name: "fake",
            namespace: "default",
        }), "POST", fakeResource);
    });
    (0, globals_1.it)("should delete a resource", async () => {
        await (0, _1.K8s)(upstream_1.Pod).Delete(fakeResource);
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            name: "fake",
            namespace: "default",
        }), "DELETE");
    });
    (0, globals_1.it)("should patch a resource", async () => {
        const patchOperations = [
            { op: "replace", path: "/metadata/name", value: "new-fake" },
        ];
        const result = await (0, _1.K8s)(upstream_1.Pod).Patch(patchOperations);
        (0, globals_1.expect)(result).toEqual(fakeResource);
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, {}, "PATCH", patchOperations);
    });
    (0, globals_1.it)("should patch the status of a resource", async () => {
        await (0, _1.K8s)(upstream_1.Pod).PatchStatus({
            metadata: {
                name: "fake",
                namespace: "default",
                managedFields: generateFakePodManagedFields("pepr"),
            },
            spec: { priority: 3 },
            status: {
                phase: "Ready",
            },
        });
        (0, globals_1.expect)(utils_1.k8sExec).toBeCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            name: "fake",
            namespace: "default",
        }), "PATCH_STATUS", {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
                name: "fake",
                namespace: "default",
                managedFields: generateFakePodManagedFields("pepr"),
            },
            spec: { priority: 3 },
            status: {
                phase: "Ready",
            },
        });
    });
    (0, globals_1.it)("should filter with WithField", async () => {
        await (0, _1.K8s)(upstream_1.Pod).WithField("metadata.name", "fake").Get();
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            fields: {
                "metadata.name": "fake",
            },
        }), "GET");
    });
    (0, globals_1.it)("should filter with WithLabel", async () => {
        await (0, _1.K8s)(upstream_1.Pod).WithLabel("app", "fakeApp").Get();
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            labels: {
                app: "fakeApp",
            },
        }), "GET");
    });
    (0, globals_1.it)("should use InNamespace", async () => {
        await (0, _1.K8s)(upstream_1.Pod).InNamespace("fakeNamespace").Get();
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            namespace: "fakeNamespace",
        }), "GET");
    });
    (0, globals_1.it)("should throw an error if namespace is already specified", async () => {
        (0, globals_1.expect)(() => (0, _1.K8s)(upstream_1.Pod, { namespace: "default" }).InNamespace("fakeNamespace")).toThrow("Namespace already specified: default");
    });
    (0, globals_1.it)("should handle Delete when the resource doesn't exist", async () => {
        mockedKubeExec.mockRejectedValueOnce({ status: 404 }); // Not Found on first call
        await (0, globals_1.expect)((0, _1.K8s)(upstream_1.Pod).Delete("fakeResource")).resolves.toBeUndefined();
    });
    (0, globals_1.it)("should handle Get", async () => {
        const result = await (0, _1.K8s)(upstream_1.Pod).Get("fakeResource");
        (0, globals_1.expect)(result).toEqual(fakeResource);
        (0, globals_1.expect)(mockedKubeExec).toHaveBeenCalledWith(upstream_1.Pod, globals_1.expect.objectContaining({
            name: "fakeResource",
        }), "GET");
    });
    (0, globals_1.it)("should thrown an error if Get is called with a name and filters are already specified a name", async () => {
        await (0, globals_1.expect)((0, _1.K8s)(upstream_1.Pod, { name: "fake" }).Get("fakeResource")).rejects.toThrow("Name already specified: fake");
    });
    (0, globals_1.it)("should throw an error if no patch operations provided", async () => {
        await (0, globals_1.expect)((0, _1.K8s)(upstream_1.Pod).Patch([])).rejects.toThrow("No operations specified");
    });
    (0, globals_1.it)("should allow Apply of deep partials", async () => {
        const result = await (0, _1.K8s)(upstream_1.Pod).Apply({ metadata: { name: "fake" }, spec: { priority: 3 } });
        (0, globals_1.expect)(result).toEqual(fakeResource);
    });
    (0, globals_1.it)("should allow force apply to resolve FieldManagerConflict", async () => {
        const result = await (0, _1.K8s)(upstream_1.Pod).Apply({
            metadata: { name: "fake", managedFields: generateFakePodManagedFields("kubectl") },
            spec: { priority: 3 },
        }, { force: true });
        (0, globals_1.expect)(result).toEqual(fakeResource);
    });
    (0, globals_1.it)("should throw an error if a Delete failed for a reason other than Not Found", async () => {
        mockedKubeExec.mockRejectedValueOnce({ status: 500 }); // Internal Server Error on first call
        await (0, globals_1.expect)((0, _1.K8s)(upstream_1.Pod).Delete("fakeResource")).rejects.toEqual(globals_1.expect.objectContaining({ status: 500 }));
    });
    (0, globals_1.it)("should create a raw api request", async () => {
        mockedKubeCfg.mockReturnValue(new Promise(r => r({
            serverUrl: "http://localhost:8080",
            opts: {},
        })));
        const mockResp = {
            kind: "APIVersions",
            versions: ["v1"],
            serverAddressByClientCIDRs: [
                {
                    serverAddress: "172.27.0.3:6443",
                },
            ],
        };
        globals_1.jest.mocked(fetch_1.fetch).mockResolvedValue({
            ok: true,
            data: mockResp,
            status: 200,
            statusText: "OK",
        });
        const result = await (0, _1.K8s)(client_node_1.V1APIGroup).Raw("/api");
        (0, globals_1.expect)(result).toEqual(mockResp);
    });
});
