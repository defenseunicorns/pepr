// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GenericClass, K8s, KubernetesObject, kind } from "kubernetes-fluent-client";

import { K8sInit, WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { WatchCfg, WatchEvent, Watcher } from "kubernetes-fluent-client/dist/fluent/watch";
import { Capability } from "./capability";
import { PeprStore } from "./k8s";
import { setupWatch } from "./watch-processor";

const uuid = "static-test";

type onCallback = (eventName: string | symbol, listener: (msg: string) => void) => void;

// Mock the dependencies
jest.mock("kubernetes-fluent-client");

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
        getCacheID: jest.fn().mockReturnValue("57332a1dee"),
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
      retryMax: 5,
      retryDelaySec: 5,
    };

    capabilities.push({
      bindings: [
        { isWatch: true, model: "someModel", filters: { name: "bleh" }, event: "Create", watchCallback: jest.fn() },
        { isWatch: false, model: "someModel", filters: {}, event: "Create", watchCallback: jest.fn() },
      ],
    } as unknown as Capability);

    await setupWatch(uuid, capabilities);

    expect(mockK8s).toHaveBeenCalledTimes(3);
    expect(mockK8s).toHaveBeenNthCalledWith(1, PeprStore);
    expect(mockK8s).toHaveBeenNthCalledWith(2, "someModel", {});
    expect(mockK8s).toHaveBeenNthCalledWith(3, "someModel", { name: "bleh" });

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining(watchCfg));
  });

  it("should not setup watches if capabilities array is empty", async () => {
    await setupWatch(uuid, []);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should not setup watches if no bindings are present", async () => {
    const capabilities = [{ bindings: [] }, { bindings: [] }] as unknown as Capability[];
    await setupWatch(uuid, capabilities);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should exit if the watch fails to start", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });

    mockStart.mockRejectedValue(new Error("err") as never);

    await setupWatch(uuid, capabilities);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should load the store before setting up watches", async () => {
    await setupWatch(uuid, capabilities);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("should set an interval to update the store every 10 seconds", async () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    await setupWatch(uuid, capabilities);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10 * 1000);
  });

  it("should update the store if there are changes every 10 seconds", async () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    mockEvents.mockImplementation((eventName: string | symbol, listener: (msg: string) => void) => {
      if (eventName === WatchEvent.RESOURCE_VERSION) {
        expect(listener).toBeInstanceOf(Function);
        listener("45");
      }
    });

    await setupWatch(uuid, capabilities);

    const flushCache = setIntervalSpy.mock.calls[0][0] as () => void;
    flushCache();

    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply).toHaveBeenNthCalledWith(1, {
      data: {
        "42dae115ed-8aa1f3": "756",
        "8aa1fde099-32a12": "750",
        "57332a1dee-73560": "45",
        "57332a1dee-57332": "45",
      },
      metadata: { name: "pepr-static-test-watch", namespace: "pepr-system" },
    });
  });

  it("should watch for the resource_update event", async () => {
    mockEvents.mockImplementation((eventName: string | symbol, listener: (msg: string) => void) => {
      if (eventName === WatchEvent.RESOURCE_VERSION) {
        expect(listener).toBeInstanceOf(Function);
        listener("45");
      }
    });

    await setupWatch(uuid, capabilities);
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

    await setupWatch(uuid, capabilities);
  });

  it("should setup watches with correct phases for different events", async () => {
    const watchCallbackCreate = jest.fn();
    const watchCallbackUpdate = jest.fn();
    const watchCallbackDelete = jest.fn();

    const capabilities = [
      {
        bindings: [
          { isWatch: true, model: "someModel", filters: {}, event: "Create", watchCallback: watchCallbackCreate },
          { isWatch: true, model: "someModel", filters: {}, event: "Update", watchCallback: watchCallbackUpdate },
          { isWatch: true, model: "someModel", filters: {}, event: "Delete", watchCallback: watchCallbackDelete },
          // Add more events here
        ],
      },
    ] as unknown as Capability[];

    await setupWatch(uuid, capabilities);

    type mockArg = [(payload: kind.Pod, phase: WatchPhase) => void, WatchCfg];

    const firstCall = mockWatch.mock.calls[0] as unknown as mockArg;
    const secondCall = mockWatch.mock.calls[1] as unknown as mockArg;
    const thirdCall = mockWatch.mock.calls[2] as unknown as mockArg;

    expect(firstCall[1].retryMax).toEqual(5);
    expect(firstCall[1].retryDelaySec).toEqual(5);
    expect(firstCall[0]).toBeInstanceOf(Function);

    firstCall[0]({} as kind.Pod, WatchPhase.Added);
    expect(watchCallbackCreate).toHaveBeenCalledTimes(1);
    expect(watchCallbackCreate).toHaveBeenCalledWith({}, WatchPhase.Added);

    firstCall[0]({} as kind.Pod, WatchPhase.Modified);
    firstCall[0]({} as kind.Pod, WatchPhase.Deleted);
    expect(watchCallbackDelete).toHaveBeenCalledTimes(0);
    expect(watchCallbackUpdate).toHaveBeenCalledTimes(0);

    watchCallbackCreate.mockClear();
    watchCallbackUpdate.mockClear();
    watchCallbackDelete.mockClear();

    secondCall[0]({} as kind.Pod, WatchPhase.Modified);
    expect(watchCallbackUpdate).toHaveBeenCalledTimes(1);
    expect(watchCallbackUpdate).toHaveBeenCalledWith({}, WatchPhase.Modified);

    secondCall[0]({} as kind.Pod, WatchPhase.Added);
    secondCall[0]({} as kind.Pod, WatchPhase.Deleted);
    expect(watchCallbackCreate).toHaveBeenCalledTimes(0);
    expect(watchCallbackDelete).toHaveBeenCalledTimes(0);

    watchCallbackCreate.mockClear();
    watchCallbackUpdate.mockClear();
    watchCallbackDelete.mockClear();

    thirdCall[0]({} as kind.Pod, WatchPhase.Deleted);
    expect(watchCallbackDelete).toHaveBeenCalledTimes(1);
    expect(watchCallbackDelete).toHaveBeenCalledWith({}, WatchPhase.Deleted);

    thirdCall[0]({} as kind.Pod, WatchPhase.Added);
    thirdCall[0]({} as kind.Pod, WatchPhase.Modified);
    expect(watchCallbackCreate).toHaveBeenCalledTimes(0);
    expect(watchCallbackUpdate).toHaveBeenCalledTimes(0);
  });
});
