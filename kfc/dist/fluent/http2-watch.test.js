"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const globals_1 = require("@jest/globals");
const http2_1 = __importDefault(require("http2"));
const __1 = require("..");
const types_1 = require("./types");
const _1 = require(".");
globals_1.jest.mock("http2");
(0, globals_1.describe)("Watcher HTTP2", () => {
    let watcher;
    let mockClient;
    let mockReq;
    const evtMock = globals_1.jest.fn();
    const errMock = globals_1.jest.fn();
    const setupAndStartWatcher = (eventType, handler) => {
        watcher.events.on(eventType, handler);
        watcher.start().catch(errMock);
    };
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        // http2.client
        mockClient = {
            request: globals_1.jest.fn(),
            close: globals_1.jest.fn(),
            on: globals_1.jest.fn(),
            destroy: globals_1.jest.fn(),
        };
        // http2.request stream
        mockReq = {
            on: globals_1.jest.fn(),
            end: globals_1.jest.fn(),
            setEncoding: globals_1.jest.fn(),
        };
        // http2.connect function to return the mocked client session
        http2_1.default.connect.mockReturnValue(mockClient);
    });
    (0, globals_1.afterEach)(() => {
        watcher.close();
    });
    (0, globals_1.it)("should watch named resources", done => {
        const pod = createMockPod("pod-1", "1");
        const response = { type: "ADDED", object: pod };
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
        });
        mockReq.on.mockImplementation((event, callback) => {
            switch (event) {
                case "response":
                    callback({ ":status": 200 }, 0);
                    break;
                case "data":
                    setTimeout(() => {
                        callback(Buffer.from(JSON.stringify(response)));
                    }, 10);
                    break;
                case "end":
                    setTimeout(() => {
                        callback();
                        done();
                    }, 20);
                    break;
                case "error":
                    errMock(new Error("HTTP2 connection error"));
                    break;
            }
            return mockReq;
        });
        mockClient.request.mockReturnValue(mockReq);
        setupAndStartWatcher(__1.WatchEvent.CONNECT, () => {
            setupAndStartWatcher(__1.WatchEvent.DATA, (receivedPod, phase) => {
                (0, globals_1.expect)(receivedPod.metadata?.name).toBe("pod-1");
                (0, globals_1.expect)(receivedPod.metadata?.resourceVersion).toBe("1");
                (0, globals_1.expect)(phase).toBe(types_1.WatchPhase.Added);
                done();
            });
        });
    });
    (0, globals_1.it)("should handle resource version is too old", done => {
        const errorResponse = {
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
        };
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
        });
        mockReq.on.mockImplementation((event, callback) => {
            switch (event) {
                case "response":
                    callback({ ":status": 200 }, 0);
                    break;
                case "data":
                    setTimeout(() => {
                        callback(Buffer.from(JSON.stringify(errorResponse)));
                    }, 10);
                    break;
                case "end":
                    setTimeout(() => {
                        callback();
                        done();
                    }, 20);
                    break;
                case "error":
                    errMock(new Error("HTTP2 connection error"));
                    break;
            }
            return mockReq;
        });
        mockClient.request.mockReturnValue(mockReq);
        setupAndStartWatcher(__1.WatchEvent.OLD_RESOURCE_VERSION, res => {
            (0, globals_1.expect)(res).toEqual("123");
            done();
        });
    });
    (0, globals_1.it)("should call the event handler for each event", done => {
        const pod = createMockPod("pod-0", "1");
        const response = { type: "ADDED", object: pod };
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch((evt, phase) => {
            (0, globals_1.expect)(evt.metadata?.name).toEqual("pod-0");
            (0, globals_1.expect)(phase).toEqual(types_1.WatchPhase.Added);
        }, { useHTTP2: true });
        mockReq.on.mockImplementation((event, callback) => {
            switch (event) {
                case "response":
                    callback({ ":status": 200 }, 0);
                    break;
                case "data":
                    setTimeout(() => {
                        callback(Buffer.from(JSON.stringify(response)));
                    }, 10);
                    break;
                case "end":
                    setTimeout(() => {
                        callback();
                    }, 20);
                    break;
                case "error":
                    errMock(new Error("HTTP2 connection error"));
                    break;
            }
            return mockReq;
        });
        mockClient.request.mockReturnValue(mockReq);
        watcher.start().catch(errMock);
        done();
    });
    (0, globals_1.it)("should return the cache id", () => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
            useHTTP2: true,
        });
        (0, globals_1.expect)(watcher.getCacheID()).toEqual("d69b75a611");
    });
    (0, globals_1.it)("should handle the CONNECT event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
            useHTTP2: true,
        });
        setupAndStartWatcher(__1.WatchEvent.CONNECT, () => { });
        done();
    });
    (0, globals_1.it)("should handle the DATA event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            resyncDelaySec: 1,
            useHTTP2: true,
        });
        setupAndStartWatcher(__1.WatchEvent.DATA, (pod, phase) => {
            (0, globals_1.expect)(pod.metadata?.name).toEqual("pod-0");
            (0, globals_1.expect)(phase).toEqual(types_1.WatchPhase.Added);
        });
        done();
    });
    (0, globals_1.it)("should handle the NETWORK_ERROR event", done => {
        const errorMessage = "Something bad happened";
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
            resyncDelaySec: 1,
        });
        mockReq.on.mockImplementation((event, callback) => {
            if (event === "response") {
                callback({ ":status": 200 }, 0);
            }
            else if (event === "error") {
                callback(new Error(errorMessage));
            }
            return mockReq;
        });
        mockClient.request.mockReturnValue(mockReq);
        setupAndStartWatcher(__1.WatchEvent.NETWORK_ERROR, error => {
            (0, globals_1.expect)(error.message).toEqual(errorMessage);
        });
        watcher.start().catch(errMock);
        done();
    });
    (0, globals_1.it)("should handle the RECONNECT event on an error", done => {
        const errorMessage = "Something bad happened";
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
            resyncDelaySec: 0.01,
        });
        let reconnectCount = 0;
        mockReq.on.mockImplementation((event, callback) => {
            if (event === "response") {
                callback({ ":status": 200 }, 0);
            }
            else if (event === "error") {
                reconnectCount += 1;
                callback(new Error(errorMessage));
            }
            return mockReq;
        });
        mockClient.request.mockReturnValue(mockReq);
        setupAndStartWatcher(__1.WatchEvent.RECONNECT, count => {
            (0, globals_1.expect)(count).toEqual(reconnectCount);
        });
        watcher.start().catch(errMock);
        done();
    });
    (0, globals_1.it)("should perform a resync after the resync interval", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
            resyncDelaySec: 1,
        });
        watcher.start().catch(errMock);
        done();
    });
    (0, globals_1.it)("should handle the GIVE_UP event", done => {
        watcher = (0, _1.K8s)(__1.kind.Pod).Watch(evtMock, {
            useHTTP2: true,
            lastSeenLimitSeconds: 0.01,
            resyncDelaySec: 0.01,
            resyncFailureMax: 1,
        });
        setupAndStartWatcher(__1.WatchEvent.GIVE_UP, () => {
            (0, globals_1.expect)(errMock).toBeCalled();
        });
        watcher.start().catch(errMock);
        done();
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
            name,
            resourceVersion,
            uid: "abc-123-xyz",
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
        status: {},
    };
}
