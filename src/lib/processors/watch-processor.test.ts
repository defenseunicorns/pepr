// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GenericClass, K8s, KubernetesObject, kind } from "kubernetes-fluent-client";
import { K8sInit, WatchPhase, WatcherType } from "kubernetes-fluent-client/dist/fluent/types";
import { WatchCfg, WatchEvent, Watcher } from "kubernetes-fluent-client/dist/fluent/watch";
import { Capability } from "../core/capability";
import {
  setupWatch,
  logEvent,
  queueKey,
  getOrCreateQueue,
  registerWatchEventHandlers,
} from "./watch-processor";
import Log from "../telemetry/logger";
import { metricsCollector, MetricsCollectorInstance } from "../telemetry/metrics";
import { EventEmitter } from "stream";

type onCallback = (eventName: string | symbol, listener: (msg: string) => void) => void;

// Mock the dependencies
jest.mock("kubernetes-fluent-client");

jest.mock("../telemetry/logger", () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../telemetry/metrics", () => ({
  metricsCollector: {
    initCacheMissWindow: jest.fn(),
    incCacheMiss: jest.fn(),
    incRetryCount: jest.fn(),
  },
}));

const testPhaseCallbacks = (
  mockCallback: (payload: kind.Pod, phase: WatchPhase) => void,
  watchCallback: jest.Mock,
  phase: WatchPhase,
  cbNotCalled: {
    callback: jest.Mock;
    phase: WatchPhase;
  }[],
) => {
  mockCallback({} as kind.Pod, phase);

  expect(watchCallback).toHaveBeenCalledTimes(1);
  expect(watchCallback).toHaveBeenCalledWith({}, phase);

  cbNotCalled.forEach(({ callback, phase }) => {
    mockCallback({} as kind.Pod, phase);
    expect(callback).not.toHaveBeenCalled();
  });
};

describe("WatchProcessor", () => {
  const mockStart = jest.fn();
  const mockK8s = jest.mocked(K8s);
  const mockApply = jest.fn();
  const mockGet = jest.fn();
  const mockWatch = jest.fn();
  const mockEvents = jest.fn() as jest.MockedFunction<onCallback>;

  const capabilities = [
    {
      bindings: [
        {
          isWatch: true,
          isQueue: false,
          model: "someModel",
          filters: {},
          event: "Create",
          watchCallback: () => {
            console.log("words");
          },
        },
      ],
    },
  ] as unknown as Capability[];

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        Apply: mockApply,
        InNamespace: jest.fn().mockReturnThis(),
        Watch: mockWatch,
        Get: mockGet,
      } as unknown as K8sInit<T, K>;
    });

    mockWatch.mockImplementation(() => {
      return {
        start: mockStart,
        events: {
          on: mockEvents,
        },
      } as unknown as Watcher<typeof kind.Pod>;
    });

    mockGet.mockImplementation(() => ({
      data: {
        "42dae115ed-8aa1f3": "756",
        "8aa1fde099-32a12": "750",
      },
    }));

    mockApply.mockImplementation(() => Promise.resolve());
  });

  it("should setup watches for all bindings with isWatch=true", async () => {
    const watchCfg: WatchCfg = {
      resyncFailureMax: 5,
      resyncDelaySec: 5,
      lastSeenLimitSeconds: 300,
      relistIntervalSec: 600,
    };

    capabilities.push({
      bindings: [
        {
          isWatch: true,
          isQueue: true,
          model: "someModel",
          filters: { name: "bleh" },
          event: "Create",
          watchCallback: jest.fn(),
        },
        {
          isWatch: false,
          isQueue: false,
          model: "someModel",
          filters: {},
          event: "Create",
          watchCallback: jest.fn(),
        },
      ],
    } as unknown as Capability);

    setupWatch(capabilities);

    expect(mockK8s).toHaveBeenCalledTimes(2);
    expect(mockK8s).toHaveBeenNthCalledWith(1, "someModel", {});
    expect(mockK8s).toHaveBeenNthCalledWith(2, "someModel", { name: "bleh" });

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining(watchCfg));
  });

  it("should not setup watches if capabilities array is empty", async () => {
    await setupWatch([]);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should not setup watches if no bindings are present", async () => {
    const capabilities = [{ bindings: [] }, { bindings: [] }] as unknown as Capability[];
    await setupWatch(capabilities);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should exit if the watch fails to start", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });

    mockStart.mockRejectedValue(new Error("err") as never);

    await setupWatch(capabilities);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should watch for the give_up event", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });

    mockEvents.mockImplementation((eventName: string | symbol, listener: (msg: string) => void) => {
      if (eventName === WatchEvent.GIVE_UP) {
        expect(listener).toBeInstanceOf(Function);
        listener("err");
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });

    setupWatch(capabilities);
  });

  it("should setup watches with correct phases for different events", async () => {
    const watchCallbackCreate = jest.fn();
    const watchCallbackUpdate = jest.fn();
    const watchCallbackDelete = jest.fn();

    const capabilities = [
      {
        bindings: [
          {
            isWatch: true,
            model: "someModel",
            filters: {},
            event: "Create",
            watchCallback: watchCallbackCreate,
          },
          {
            isWatch: true,
            model: "someModel",
            filters: {},
            event: "Update",
            watchCallback: watchCallbackUpdate,
          },
          {
            isWatch: true,
            model: "someModel",
            filters: {},
            event: "Delete",
            watchCallback: watchCallbackDelete,
          },
          // Add more events here
        ],
      },
    ] as unknown as Capability[];

    setupWatch(capabilities);

    type mockArg = [(payload: kind.Pod, phase: WatchPhase) => void, WatchCfg];

    const [firstCall, secondCall, thirdCall] = mockWatch.mock.calls as unknown as mockArg[];

    expect(firstCall[1].resyncFailureMax).toEqual(5);
    expect(firstCall[1].resyncDelaySec).toEqual(5);
    expect(firstCall[0]).toBeInstanceOf(Function);

    testPhaseCallbacks(firstCall[0], watchCallbackCreate, WatchPhase.Added, [
      { callback: watchCallbackUpdate, phase: WatchPhase.Modified },
      { callback: watchCallbackDelete, phase: WatchPhase.Deleted },
    ]);

    watchCallbackCreate.mockClear();
    watchCallbackUpdate.mockClear();
    watchCallbackDelete.mockClear();

    testPhaseCallbacks(secondCall[0], watchCallbackUpdate, WatchPhase.Modified, [
      { callback: watchCallbackCreate, phase: WatchPhase.Added },
      { callback: watchCallbackDelete, phase: WatchPhase.Deleted },
    ]);

    watchCallbackCreate.mockClear();
    watchCallbackUpdate.mockClear();
    watchCallbackDelete.mockClear();

    testPhaseCallbacks(thirdCall[0], watchCallbackDelete, WatchPhase.Deleted, [
      { callback: watchCallbackCreate, phase: WatchPhase.Added },
      { callback: watchCallbackUpdate, phase: WatchPhase.Modified },
    ]);
  });

  it("should call the metricsCollector methods on respective events", async () => {
    const mockIncCacheMiss = metricsCollector.incCacheMiss;
    const mockInitCacheMissWindow = metricsCollector.initCacheMissWindow;
    const mockIncRetryCount = metricsCollector.incRetryCount;

    const watchCallback = jest.fn();
    const capabilities = [
      {
        bindings: [
          {
            isWatch: true,
            model: "someModel",
            filters: {},
            event: "Create",
            watchCallback: watchCallback,
          },
        ],
      },
    ] as unknown as Capability[];

    setupWatch(capabilities);

    type mockArg = [(payload: kind.Pod, phase: WatchPhase) => void, WatchCfg];

    const firstCall = mockWatch.mock.calls[0] as unknown as mockArg;

    const cacheMissWindowName = "window-1";
    const retryCount = "retry-1";

    firstCall[0]({} as kind.Pod, WatchPhase.Added);
    mockEvents.mock.calls.forEach(call => {
      if (call[0] === WatchEvent.CACHE_MISS) {
        call[1](cacheMissWindowName);
      }
      if (call[0] === WatchEvent.INIT_CACHE_MISS) {
        call[1](cacheMissWindowName);
      }
      if (call[0] === WatchEvent.INC_RESYNC_FAILURE_COUNT) {
        call[1](retryCount);
      }
    });

    expect(mockIncCacheMiss).toHaveBeenCalledWith(cacheMissWindowName);
    expect(mockInitCacheMissWindow).toHaveBeenCalledWith(cacheMissWindowName);
    expect(mockIncRetryCount).toHaveBeenCalledWith(retryCount);
  });

  it("should call parseInt with process.env.PEPR_RELIST_INTERVAL_SECONDS", async () => {
    const parseIntSpy = jest.spyOn(global, "parseInt");

    process.env.PEPR_RELIST_INTERVAL_SECONDS = "1800";
    process.env.PEPR_LAST_SEEN_LIMIT_SECONDS = "300";
    process.env.PEPR_RESYNC_DELAY_SECONDS = "60";
    process.env.PEPR_RESYNC_FAILURE_MAX = "5";

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const watchCfg: WatchCfg = {
      resyncFailureMax: parseInt(process.env.PEPR_RESYNC_FAILURE_MAX, 10),
      resyncDelaySec: parseInt(process.env.PEPR_RESYNC_DELAY_SECONDS, 10),
      lastSeenLimitSeconds: parseInt(process.env.PEPR_LAST_SEEN_LIMIT_SECONDS, 10),
      relistIntervalSec: parseInt(process.env.PEPR_RELIST_INTERVAL_SECONDS, 10),
    };

    capabilities.push({
      bindings: [
        {
          isWatch: true,
          model: "someModel",
          filters: { name: "bleh" },
          event: "Create",
          watchCallback: jest.fn(),
        },
        {
          isWatch: false,
          model: "someModel",
          filters: {},
          event: "Create",
          watchCallback: jest.fn(),
        },
      ],
    } as unknown as Capability);

    setupWatch(capabilities);

    expect(parseIntSpy).toHaveBeenCalledWith("1800", 10);
    expect(parseIntSpy).toHaveBeenCalledWith("300", 10);
    expect(parseIntSpy).toHaveBeenCalledWith("60", 10);
    expect(parseIntSpy).toHaveBeenCalledWith("5", 10);
    parseIntSpy.mockRestore();
  });
});

describe("logEvent function", () => {
  it("should handle data events", () => {
    const mockObj = { id: "123", type: "Pod" } as KubernetesObject;
    const message = "Test message";
    logEvent(WatchEvent.DATA, message, mockObj);
    expect(Log.debug).toHaveBeenCalledWith(
      mockObj,
      `Watch event ${WatchEvent.DATA} received. ${message}.`,
    );
  });

  it("should handle CONNECT events", () => {
    const url = "/api/v1/namespaces/default/pods?watch=true&resourceVersion=0";
    logEvent(WatchEvent.CONNECT, url);
    expect(Log.debug).toHaveBeenCalledWith(`Watch event ${WatchEvent.CONNECT} received. ${url}.`);
  });

  it("should handle LIST_ERROR events", () => {
    const message = "LIST_ERROR";
    logEvent(WatchEvent.LIST_ERROR, message);
    expect(Log.debug).toHaveBeenCalledWith(
      `Watch event ${WatchEvent.LIST_ERROR} received. ${message}.`,
    );
  });
  it("should handle LIST events", () => {
    const podList = {
      kind: "PodList",
      apiVersion: "v1",
      metadata: { resourceVersion: "10245" },
      items: [],
    };
    const message = JSON.stringify(podList, undefined, 2);
    logEvent(WatchEvent.LIST, message);
    expect(Log.debug).toHaveBeenCalledWith(`Watch event ${WatchEvent.LIST} received. ${message}.`);
  });

  it("should handle DATA_ERROR events", () => {
    const message = "Test message";
    logEvent(WatchEvent.DATA_ERROR, message);
    expect(Log.debug).toHaveBeenCalledWith(
      `Watch event ${WatchEvent.DATA_ERROR} received. ${message}.`,
    );
  });
});

describe("queueKey", () => {
  const withKindNsName = {
    kind: "Pod",
    metadata: { namespace: "my-ns", name: "my-name" },
  } as KubernetesObject;
  const withKindNs = { kind: "Pod", metadata: { namespace: "my-ns" } } as KubernetesObject;
  const withKindName = { kind: "Pod", metadata: { name: "my-name" } } as KubernetesObject;
  const withNsName = { metadata: { namespace: "my-ns", name: "my-name" } } as KubernetesObject;
  const withKind = { kind: "Pod" } as KubernetesObject;
  const withNs = { metadata: { namespace: "my-ns" } } as KubernetesObject;
  const withName = { metadata: { name: "my-name" } } as KubernetesObject;
  const withNone = {} as KubernetesObject;

  const original = process.env.PEPR_RECONCILE_STRATEGY;

  it.each([
    ["kind", withKindNsName, "Pod"],
    ["kind", withKindNs, "Pod"],
    ["kind", withKindName, "Pod"],
    ["kind", withNsName, "UnknownKind"],
    ["kind", withKind, "Pod"],
    ["kind", withNs, "UnknownKind"],
    ["kind", withName, "UnknownKind"],
    ["kind", withNone, "UnknownKind"],
    ["kindNs", withKindNsName, "Pod/my-ns"],
    ["kindNs", withKindNs, "Pod/my-ns"],
    ["kindNs", withKindName, "Pod/cluster-scoped"],
    ["kindNs", withNsName, "UnknownKind/my-ns"],
    ["kindNs", withKind, "Pod/cluster-scoped"],
    ["kindNs", withNs, "UnknownKind/my-ns"],
    ["kindNs", withName, "UnknownKind/cluster-scoped"],
    ["kindNs", withNone, "UnknownKind/cluster-scoped"],
    ["kindNsName", withKindNsName, "Pod/my-ns/my-name"],
    ["kindNsName", withKindNs, "Pod/my-ns/Unnamed"],
    ["kindNsName", withKindName, "Pod/cluster-scoped/my-name"],
    ["kindNsName", withNsName, "UnknownKind/my-ns/my-name"],
    ["kindNsName", withKind, "Pod/cluster-scoped/Unnamed"],
    ["kindNsName", withNs, "UnknownKind/my-ns/Unnamed"],
    ["kindNsName", withName, "UnknownKind/cluster-scoped/my-name"],
    ["kindNsName", withNone, "UnknownKind/cluster-scoped/Unnamed"],
    ["global", withKindNsName, "global"],
    ["global", withKindNs, "global"],
    ["global", withKindName, "global"],
    ["global", withNsName, "global"],
    ["global", withKind, "global"],
    ["global", withNs, "global"],
    ["global", withName, "global"],
    ["global", withNone, "global"],
  ])("PEPR_RECONCILE_STRATEGY='%s' over '%j' becomes '%s'", (strat, obj, key) => {
    process.env.PEPR_RECONCILE_STRATEGY = strat;
    expect(queueKey(obj)).toBe(key);
  });

  afterAll(() => {
    process.env.PEPR_RECONCILE_STRATEGY = original;
  });
});

describe("getOrCreateQueue", () => {
  it("creates a Queue instance on first call", () => {
    const obj: KubernetesObject = {
      kind: "queue",
      metadata: {
        name: "nm",
        namespace: "ns",
      },
    };

    const firstQueue = getOrCreateQueue(obj);
    expect(firstQueue.label()).toBeDefined();
  });

  it("returns same Queue instance on subsequent calls", () => {
    const obj: KubernetesObject = {
      kind: "queue",
      metadata: {
        name: "nm",
        namespace: "ns",
      },
    };

    const firstQueue = getOrCreateQueue(obj);
    expect(firstQueue.label()).toBeDefined();

    const secondQueue = getOrCreateQueue(obj);
    expect(secondQueue.label()).toBeDefined();

    expect(firstQueue).toBe(secondQueue);
  });
});

describe("registerWatchEventHandlers", () => {
  let watcher: WatcherType<GenericClass>;
  let logEvent: jest.Mock;
  let metricsCollector: MetricsCollectorInstance;
  let mockExit: jest.SpiedFunction<(code?: number | string | null | undefined) => never>;

  beforeEach(() => {
    const eventEmitter = new EventEmitter();

    watcher = {
      events: eventEmitter,
    } as unknown as WatcherType<GenericClass>;

    jest.spyOn(eventEmitter, "on");
    logEvent = jest.fn();

    metricsCollector = {
      incCacheMiss: jest.fn(),
      initCacheMissWindow: jest.fn(),
      incRetryCount: jest.fn(),
    } as unknown as MetricsCollectorInstance;

    mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });

    registerWatchEventHandlers(watcher, logEvent, metricsCollector);
  });

  describe("logs events correctly", () => {
    it.each([
      [WatchEvent.CONNECT, "url", WatchEvent.CONNECT, "url"],
      [WatchEvent.DATA_ERROR, new Error("data_error"), WatchEvent.DATA_ERROR, "data_error"],
      [WatchEvent.RECONNECT, 1, WatchEvent.RECONNECT, "Reconnecting after 1 attempt"],
      [WatchEvent.RECONNECT_PENDING, undefined, WatchEvent.RECONNECT_PENDING, undefined],
      [WatchEvent.ABORT, new Error("abort"), WatchEvent.ABORT, "abort"],
      [
        WatchEvent.OLD_RESOURCE_VERSION,
        "old_resource_version",
        WatchEvent.OLD_RESOURCE_VERSION,
        "old_resource_version",
      ],
      [
        WatchEvent.NETWORK_ERROR,
        new Error("network_error"),
        WatchEvent.NETWORK_ERROR,
        "network_error",
      ],
      [WatchEvent.LIST_ERROR, new Error("network_error"), WatchEvent.LIST_ERROR, "network_error"],
      [
        WatchEvent.LIST,
        { apiVersion: "v1", items: [] },
        WatchEvent.LIST,
        JSON.stringify({ apiVersion: "v1", items: [] }, undefined, 2),
      ],
    ])("logs event %s correctly", (event, input, expectedEvent, expectedMessage) => {
      if (event === WatchEvent.RECONNECT_PENDING) {
        watcher.events.emit(event);
        expect(logEvent).toHaveBeenCalledWith(expectedEvent);
      } else {
        watcher.events.emit(event, input);
        expect(logEvent).toHaveBeenCalledWith(expectedEvent, expectedMessage);
      }
    });

    it("logs GIVE_UP event and exits process", () => {
      const error = new Error("Giving up");

      watcher.events.emit(WatchEvent.GIVE_UP, error);

      expect(logEvent).toHaveBeenCalledWith(WatchEvent.GIVE_UP, "Giving up");
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("calls metric functions correctly", () => {
    it.each([
      [WatchEvent.CACHE_MISS, "2025-02-05T04:14:39.535Z", "incCacheMiss"],
      [WatchEvent.INIT_CACHE_MISS, "2025-02-05T04:14:39.535Z", "initCacheMissWindow"],
      [WatchEvent.INC_RESYNC_FAILURE_COUNT, 1, "incRetryCount"],
    ])("calls metric function %s", (event, input, methodName) => {
      watcher.events.emit(event, input);
      expect(metricsCollector[methodName as keyof MetricsCollectorInstance]).toHaveBeenCalledWith(
        input,
      );
    });
  });

  it("does not log event on DATA", () => {
    watcher.events.emit(WatchEvent.DATA);
    expect(logEvent).not.toHaveBeenCalled();
  });
});
