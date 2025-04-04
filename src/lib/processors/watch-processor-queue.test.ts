// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { WatcherType } from "kubernetes-fluent-client/dist/fluent/types";
import { WatchEvent } from "kubernetes-fluent-client/dist/fluent/watch";
import { queueKey, getOrCreateQueue, registerWatchEventHandlers } from "./watch-processor";
import { MetricsCollectorInstance } from "../telemetry/metrics";
import { EventEmitter } from "stream";

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

    it("logs GIVE_UP event and throws error", () => {
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
});
