// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, jest } from "@jest/globals";
import { K8s, KubernetesObject, kind } from "kubernetes-fluent-client";

import { K8sInit, WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { WatchCfg } from "kubernetes-fluent-client/dist/fluent/watch";
import { Capability } from "./capability";
import { setupWatch } from "./watch-processor";

// Mock the dependencies
jest.mock("kubernetes-fluent-client");

describe("WatchProcessor", () => {
  it("should setup watches for all bindings with isWatch=true", () => {
    const mockK8s = jest.mocked(K8s);
    const mockWatch = jest.fn();
    mockK8s.mockImplementation(<T extends KubernetesObject>() => {
      return { Watch: mockWatch } as unknown as K8sInit<T>;
    });

    const watchCfg: WatchCfg = {
      retryMax: 3,
      retryDelaySec: 5,
    };

    const capabilities = [
      {
        bindings: [
          { isWatch: true, model: "someModel", filters: { name: "bleh" }, event: "Create" },
          { isWatch: false, model: "someModel", filters: {}, event: "Create" },
        ],
      },
      {
        bindings: [{ isWatch: true, model: "someModel", filters: {}, event: "Create" }],
      },
    ] as unknown as Capability[];

    setupWatch(capabilities);

    expect(mockK8s).toHaveBeenCalledTimes(2);
    expect(mockK8s).toHaveBeenNthCalledWith(1, "someModel", { name: "bleh" });
    expect(mockK8s).toHaveBeenNthCalledWith(2, "someModel", {});

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining(watchCfg));
  });

  it("should not setup watches if capabilities array is empty", () => {
    const mockWatch = jest.fn();
    setupWatch([]);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should not setup watches if no bindings are present", () => {
    const mockWatch = jest.fn();
    const capabilities = [{ bindings: [] }, { bindings: [] }] as unknown as Capability[];
    setupWatch(capabilities);
    expect(mockWatch).toHaveBeenCalledTimes(0);
  });

  it("should setup watches with correct phases for different events", () => {
    const mockWatch = jest.fn();
    jest.mocked(K8s).mockImplementation(<T extends KubernetesObject>() => {
      return { Watch: mockWatch } as unknown as K8sInit<T>;
    });

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

    setupWatch(capabilities);

    type mockArg = [(payload: kind.Pod, phase: WatchPhase) => void, WatchCfg];

    const firstCall = mockWatch.mock.calls[0] as unknown as mockArg;
    const secondCall = mockWatch.mock.calls[1] as unknown as mockArg;
    const thirdCall = mockWatch.mock.calls[2] as unknown as mockArg;

    expect(firstCall[1].retryMax).toEqual(3);
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
