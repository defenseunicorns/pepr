"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const undici_1 = require("undici");
const stream_1 = require("stream");
const _1 = require(".");
const __1 = require("..");
const types_1 = require("./types");
(0, globals_1.describe)("Watcher", () => {
    const evtMock = globals_1.jest.fn();
    const errMock = globals_1.jest.fn();
    const setupAndStartWatcher = (eventType, handler) => {
        watcher.events.on(eventType, handler);
        watcher.start().catch(errMock);
    };
    let watcher;
    let mockAgent;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.resetAllMocks();
        // Setup MockAgent from undici
        mockAgent = new undici_1.MockAgent();
        mockAgent.disableNetConnect();
        (0, undici_1.setGlobalDispatcher)(mockAgent);
        const mockClient = mockAgent.get("http://jest-test:8080");
        // Mock list operation
        mockClient
            .intercept({
            path: "/api/v1/pods",
            method: "GET",
        })
            .reply(200, {
            kind: "PodList",
            apiVersion: "v1",
            metadata: {
                resourceVersion: "10",
            },
            items: [createMockPod(`pod-0`, `1`)],
        });
        mockClient
            .intercept({
            path: "/api/v1/pods?watch=true&resourceVersion=10",
            method: "GET",
        })
            // @ts-expect-error - we are using the response.body as Readable stream
            .reply(200, (_, res) => {
            const stream = new stream_1.PassThrough();
            const resources = [
                { type: "ADDED", object: createMockPod(`pod-0`, `1`) },
                { type: "MODIFIED", object: createMockPod(`pod-0`, `2`) },
            ];
            resources.forEach(resource => {
                stream.write(JSON.stringify(resource) + "\n");
            });
            stream.end();
            res.body = stream;
        });
    });
    (0, globals_1.afterEach)(() => {
        watcher.close();
        mockAgent.close();
    });
    (0, globals_1.it)("should watch named resources", done => {
        const mockClient = mockAgent.get("http://jest-test:8080");
        mockClient
            .intercept({
            path: "/api/v1/namespaces/tester/pods?fieldSelector=metadata.name=demo",
            method: "GET",
        })
            .reply(200, createMockPod(`demo`, `15`));
        mockClient
            .intercept({
            path: "/api/v1/namespaces/tester/pods?watch=true&fieldSelector=metadata.name=demo&resourceVersion=15",
            method: "GET",
        })
            .reply(200);
        watcher = (0, _1.K8s)(__1.kind.Pod, { name: "demo" }).InNamespace("tester").Watch(evtMock);
        setupAndStartWatcher(__1.WatchEvent.CONNECT, () => {
            done();
        });
    });
    (0, globals_1.it)("should handle resource version is too old", done => {
        const mockClient = mockAgent.get("http://jest-test:8080");
        mockClient
            .intercept({
            path: "/api/v1/pods",
            method: "GET",
        })
            .reply(200, {
            kind: "PodList",
            apiVersion: "v1",
            metadata: {
                resourceVersion: "25",
            },
            items: [createMockPod(`pod-0`, `1`)],
        });
        mockClient
            .intercept({
            path: "/api/v1/pods?watch=true&resourceVersion=25",
            method: "GET",
        })
            // @ts-expect-error - need res for the body
            .reply(200, (_, res) => {
            const stream = new stream_1.PassThrough();
            stream.write(JSON.stringify({
                type: "ERROR",
                object: {
                    kind: "Status",
                    apiVersion: "v1",
                    metadata: {},
                    status: "Failure",
                    message: "too old resource version: 123 (391079)",
                    reason: "Gone",
                    code: 410,
                },
            }) + "\n");
            stream.end();
            res.body = stream;
        });
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock);
        setupAndStartWatcher(__1.WatchEvent.OLD_RESOURCE_VERSION, res => {
            (0, globals_1.expect)(res).toEqual("25");
            done();
        });
    });
    (0, globals_1.it)("should call the event handler for each event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch((evt, phase) => {
            (0, globals_1.expect)(evt.metadata?.name).toEqual(`pod-0`);
            (0, globals_1.expect)(phase).toEqual(types_1.WatchPhase.Added);
            done();
        });
        watcher.start().catch(errMock);
    });
    (0, globals_1.it)("should return the cache id", () => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
        });
        (0, globals_1.expect)(watcher.getCacheID()).toEqual("d69b75a611");
    });
    (0, globals_1.it)("should handle the CONNECT event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
        });
        setupAndStartWatcher(__1.WatchEvent.CONNECT, () => {
            done();
        });
    });
    (0, globals_1.it)("should handle the DATA event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
        });
        setupAndStartWatcher(__1.WatchEvent.DATA, (pod, phase) => {
            (0, globals_1.expect)(pod.metadata?.name).toEqual(`pod-0`);
            (0, globals_1.expect)(phase).toEqual(types_1.WatchPhase.Added);
            done();
        });
    });
    (0, globals_1.it)("should handle the RECONNECT event on an error", done => {
        const mockClient = mockAgent.get("http://jest-test:8080");
        mockClient
            .intercept({
            path: "/api/v1/pods",
            method: "GET",
        })
            .reply(200, {
            kind: "PodList",
            apiVersion: "v1",
            metadata: {
                resourceVersion: "65",
            },
            items: [createMockPod(`pod-0`, `1`)],
        });
        mockClient
            .intercept({
            path: "/api/v1/pods?watch=true&resourceVersion=65",
            method: "GET",
        })
            .replyWithError(new Error("Something bad happened"));
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 0.01,
        });
        setupAndStartWatcher(__1.WatchEvent.RECONNECT, count => {
            (0, globals_1.expect)(count).toEqual(1);
            done();
        });
    });
    (0, globals_1.it)("should perform a resync after the resync interval", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 0.01,
            lastSeenLimitSeconds: 0.01,
        });
        setupAndStartWatcher(__1.WatchEvent.RECONNECT, count => {
            (0, globals_1.expect)(count).toEqual(1);
            done();
        });
    });
    (0, globals_1.it)("should handle the GIVE_UP event", done => {
        const mockClient = mockAgent.get("http://jest-test:8080");
        mockClient
            .intercept({
            path: "/api/v1/pods",
            method: "GET",
        })
            .reply(200, {
            kind: "PodList",
            apiVersion: "v1",
            metadata: {
                resourceVersion: "75",
            },
            items: [createMockPod(`pod-0`, `1`)],
        });
        mockClient
            .intercept({
            path: "/api/v1/pods?watch=true&resourceVersion=75",
            method: "GET",
        })
            .replyWithError(new Error("Something bad happened"));
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncFailureMax: 1,
            resyncDelaySec: 0.01,
            lastSeenLimitSeconds: 1,
        });
        setupAndStartWatcher(__1.WatchEvent.GIVE_UP, error => {
            (0, globals_1.expect)(error.message).toContain("Retry limit (1) exceeded, giving up");
            done();
        });
    });
});
/**
 * Creates a mock pod object
 *
 * @param name The name of the pod
 * @param resourceVersion The resource version of the pod
 * @returns A mock pod object
 */
function createMockPod(name, resourceVersion) {
    return {
        kind: "Pod",
        apiVersion: "v1",
        metadata: {
            name: name,
            resourceVersion: resourceVersion,
            uid: Math.random().toString(36).substring(7),
        },
        spec: {
            containers: [
                {
                    name: "nginx",
                    image: "nginx:1.14.2",
                    ports: [
                        {
                            containerPort: 80,
                            protocol: "TCP",
                        },
                    ],
                },
            ],
        },
        status: {
        // ... pod status
        },
    };
}
