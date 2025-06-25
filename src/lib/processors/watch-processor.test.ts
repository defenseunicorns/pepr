// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from "vitest";
import { GenericClass, K8s, KubernetesObject, kind } from "kubernetes-fluent-client";
import { K8sInit, WatcherType } from "kubernetes-fluent-client/dist/fluent/types";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { WatchCfg, WatchEvent, Watcher } from "kubernetes-fluent-client/dist/fluent/watch";
import { Capability } from "../core/capability";
import { setupWatch, logEvent, runBinding, registerWatchEventHandlers } from "./watch-processor";
import Log from "../telemetry/logger";
import { metricsCollector, MetricsCollectorInstance } from "../telemetry/metrics";
import EventEmitter from "events";

type onCallback = (eventName: string | symbol, listener: (msg: Error | string) => void) => void;

vi.mock("kubernetes-fluent-client");

vi.mock("../telemetry/logger", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../telemetry/metrics", () => ({
  metricsCollector: {
    initCacheMissWindow: vi.fn(),
    incCacheMiss: vi.fn(),
    incRetryCount: vi.fn(),
  },
}));

const testPhaseCallbacks = (
  mockCallback: (payload: kind.Pod, phase: WatchPhase) => void,
  watchCallback: Mock,
  phase: WatchPhase,
  cbNotCalled: {
    callback: Mock;
    phase: WatchPhase;
  }[],
): void => {
  mockCallback({} as kind.Pod, phase);

  expect(watchCallback).toHaveBeenCalledTimes(1);
  expect(watchCallback).toHaveBeenCalledWith({}, phase);

  cbNotCalled.forEach(({ callback, phase }) => {
    mockCallback({} as kind.Pod, phase);
    expect(callback).not.toHaveBeenCalled();
  });
};

describe("WatchProcessor", () => {
  const mockStart = vi.fn();
  const mockK8s = vi.mocked(K8s);
  const mockApply = vi.fn();
  const mockGet = vi.fn();
  const mockWatch = vi.fn();
  const mockEvents = vi.fn() as MockInstance<onCallback>;

  const capabilities = [
    {
      bindings: [
        {
          isWatch: true,
          isQueue: false,
          model: "someModel",
          filters: {},
          event: "Create",
          watchCallback: (): void => {
            console.log("words");
          },
        },
      ],
    },
  ] as unknown as Capability[];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Set up all mock implementations after reset
    mockStart.mockImplementation(() => Promise.resolve());
    mockWatch.mockImplementation(
      () =>
        ({
          start: mockStart,
          events: {
            on: mockEvents,
          },
        }) as unknown as Watcher<typeof kind.Pod>,
    );

    mockGet.mockImplementation(() => ({
      data: {
        "42dae115ed-8aa1f3": "756",
        "8aa1fde099-32a12": "750",
      },
    }));

    mockApply.mockImplementation(() => Promise.resolve());

    // Set up K8s mock last since it depends on other mocks
    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        Apply: mockApply,
        InNamespace: vi.fn().mockReturnThis(),
        Watch: mockWatch,
        Get: mockGet,
      } as unknown as K8sInit<T, K>;
    });
  });

  describe("when initializing watches", () => {
    it("sets up watches for all bindings that have isWatch enabled", async () => {
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
            watchCallback: vi.fn(),
          },
          {
            isWatch: false,
            isQueue: false,
            model: "someModel",
            filters: {},
            event: "Create",
            watchCallback: vi.fn(),
          },
        ],
      } as unknown as Capability);

      setupWatch(capabilities);

      expect(mockK8s).toHaveBeenCalledTimes(2);
      expect(mockK8s).toHaveBeenNthCalledWith(1, "someModel", {});
      expect(mockK8s).toHaveBeenNthCalledWith(2, "someModel", { name: "bleh" });

      expect(mockWatch).toHaveBeenCalledTimes(2);
      expect(mockWatch).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining(watchCfg),
      );
    });

    it("should not setup watches if capabilities array is empty", async () => {
      setupWatch([]);
      expect(mockWatch).toHaveBeenCalledTimes(0);
    });

    it("should not setup watches if no bindings are present", async () => {
      const capabilities = [{ bindings: [] }, { bindings: [] }] as unknown as Capability[];
      setupWatch(capabilities);
      expect(mockWatch).toHaveBeenCalledTimes(0);
    });

    it("should throw a WatchStart error with cause if the watch fails to start", async () => {
      const rootCause = new Error("err");
      mockStart.mockRejectedValue(rootCause as never);

      const capabilities = [
        {
          bindings: [
            {
              isWatch: true,
              model: "someModel",
              filters: {},
              event: "Create",
              watchCallback: vi.fn(),
            },
          ],
        },
      ] as unknown as Capability[];
      try {
        await runBinding(capabilities[0].bindings[0], [], []);
        throw new Error("Expected error was not thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe("WatchStart Error: Unable to start watch.");
        expect(err.cause).toBe(rootCause);
      }
    });

    it("should throw a WatchEvent GiveUp error with cause if GIVE_UP event is triggered", async () => {
      const rootCause = new Error(
        "WatchEvent GiveUp Error: The watch has failed to start after several attempts.",
      );

      mockEvents.mockImplementation(
        (eventName: string | symbol, listener: (msg: Error | string) => void) => {
          if (eventName === WatchEvent.GIVE_UP) {
            listener(rootCause);
          }
        },
      );

      mockStart.mockImplementation(() => Promise.resolve());
      const capabilities = [
        {
          bindings: [
            {
              isWatch: true,
              model: "someModel",
              filters: {},
              event: "Create",
              watchCallback: vi.fn(),
            },
          ],
        },
      ] as unknown as Capability[];
      try {
        await runBinding(capabilities[0].bindings[0], [], []);
        throw new Error("Expected GIVE_UP error was not thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(
          "WatchEventHandler Registration Error: Unable to register event watch handler.",
        );
        expect(err.cause).toStrictEqual(rootCause);
      }
    });

    describe("when handling events", () => {
      it("configures watches with appropriate phases for each event type", async () => {
        const watchCallbackCreate = vi.fn();
        const watchCallbackUpdate = vi.fn();
        const watchCallbackDelete = vi.fn();

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

      it("tracks metrics by calling collector methods for each event", async () => {
        const mockIncCacheMiss = metricsCollector.incCacheMiss;
        const mockInitCacheMissWindow = metricsCollector.initCacheMissWindow;
        const mockIncRetryCount = metricsCollector.incRetryCount;

        const watchCallback = vi.fn();
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

        await runBinding(capabilities[0].bindings[0], [], []);

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

      it("uses environment variable to configure relist interval", async () => {
        const parseIntSpy = vi.spyOn(global, "parseInt");

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
              watchCallback: vi.fn(),
            },
            {
              isWatch: false,
              model: "someModel",
              filters: {},
              event: "Create",
              watchCallback: vi.fn(),
            },
          ],
        } as unknown as Capability);

        await runBinding(capabilities[0].bindings[0], [], []);

        expect(parseIntSpy).toHaveBeenCalledWith("1800", 10);
        expect(parseIntSpy).toHaveBeenCalledWith("300", 10);
        expect(parseIntSpy).toHaveBeenCalledWith("60", 10);
        expect(parseIntSpy).toHaveBeenCalledWith("5", 10);
        parseIntSpy.mockRestore();
      });
    });
  });
});

describe("Event Logging", () => {
  describe("when handling different event types", () => {
    it("logs data events", () => {
      const mockObj = { id: "123", type: "Pod" } as KubernetesObject;
      const message = "Test message";
      logEvent(WatchEvent.DATA, message, mockObj);
      expect(Log.debug).toHaveBeenCalledWith(
        mockObj,
        `Watch event ${WatchEvent.DATA} received. ${message}.`,
      );
    });

    it("logs connection establishment", () => {
      const url = "/api/v1/namespaces/default/pods?watch=true&resourceVersion=0";
      logEvent(WatchEvent.CONNECT, url);
      expect(Log.debug).toHaveBeenCalledWith(`Watch event ${WatchEvent.CONNECT} received. ${url}.`);
    });

    it("logs list operations", () => {
      const podList = {
        kind: "PodList",
        apiVersion: "v1",
        metadata: { resourceVersion: "10245" },
        items: [],
      };
      const message = JSON.stringify(podList, undefined, 2);
      logEvent(WatchEvent.LIST, message);
      expect(Log.debug).toHaveBeenCalledWith(
        `Watch event ${WatchEvent.LIST} received. ${message}.`,
      );
    });

    it("logs data processing errors", () => {
      const message = "Test message";
      logEvent(WatchEvent.DATA_ERROR, message);
      expect(Log.debug).toHaveBeenCalledWith(
        `Watch event ${WatchEvent.DATA_ERROR} received. ${message}.`,
      );
    });
  });
});

describe("Watch Event Handling", () => {
  let watcher: WatcherType<GenericClass>;
  let logEvent: Mock;
  let metricsCollector: MetricsCollectorInstance;

  beforeEach(() => {
    const eventEmitter = new EventEmitter();

    watcher = {
      events: eventEmitter,
    } as unknown as WatcherType<GenericClass>;

    vi.spyOn(eventEmitter, "on");
    logEvent = vi.fn();

    metricsCollector = {
      incCacheMiss: vi.fn(),
      initCacheMissWindow: vi.fn(),
      incRetryCount: vi.fn(),
    } as unknown as MetricsCollectorInstance;

    registerWatchEventHandlers(watcher, logEvent, metricsCollector);
  });

  it("suppresses DATA events", () => {
    watcher.events.emit(WatchEvent.DATA);
    expect(logEvent).not.toHaveBeenCalled();
  });

  describe("when logging events", () => {
    it.each([
      ["connection", WatchEvent.CONNECT, "url", "url"],
      ["data error", WatchEvent.DATA_ERROR, new Error("data_error"), "data_error"],
      ["reconnection", WatchEvent.RECONNECT, 1, "Reconnecting after 1 attempt"],
      ["pending reconnect", WatchEvent.RECONNECT_PENDING, undefined, undefined],
      ["abort", WatchEvent.ABORT, new Error("abort"), "abort"],
      [
        "old resource version",
        WatchEvent.OLD_RESOURCE_VERSION,
        "old_resource_version",
        "old_resource_version",
      ],
      ["network error", WatchEvent.NETWORK_ERROR, new Error("network_error"), "network_error"],
      ["list error", WatchEvent.LIST_ERROR, new Error("list_error"), "list_error"],
      [
        "list operation",
        WatchEvent.LIST,
        { apiVersion: "v1", items: [] },
        JSON.stringify({ apiVersion: "v1", items: [] }, undefined, 2),
      ],
    ])("records %s events", (_name, event, input, expected) => {
      watcher.events.emit(event, input);
      if (event === WatchEvent.RECONNECT_PENDING) {
        expect(logEvent).toHaveBeenCalledWith(event);
      } else {
        expect(logEvent).toHaveBeenCalledWith(event, expected);
      }
    });

    it("handles GIVE_UP events with error escalation", () => {
      const rootCause = new Error("Some error message");
      try {
        watcher.events.emit(WatchEvent.GIVE_UP, rootCause);
        throw new Error("Expected GIVE_UP error was not thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(
          "WatchEvent GiveUp Error: The watch has failed to start after several attempts.",
        );
        expect(err.cause).toStrictEqual(rootCause);
      }

      expect(logEvent).toHaveBeenCalledWith(WatchEvent.GIVE_UP, "Some error message");
    });
  });

  describe("when collecting metrics", () => {
    it.each([
      ["cache miss", WatchEvent.CACHE_MISS, "2025-02-05T04:14:39.535Z", "incCacheMiss"],
      [
        "initial cache miss",
        WatchEvent.INIT_CACHE_MISS,
        "2025-02-05T04:14:39.535Z",
        "initCacheMissWindow",
      ],
      ["resync failure", WatchEvent.INC_RESYNC_FAILURE_COUNT, 1, "incRetryCount"],
    ])("tracks %s", (_name, event, input, method) => {
      watcher.events.emit(event, input);
      expect(metricsCollector[method as keyof MetricsCollectorInstance]).toHaveBeenCalledWith(
        input,
      );
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
