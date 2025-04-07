// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { afterAll, describe, expect, it, jest } from "@jest/globals";
import { KubernetesObject } from "kubernetes-fluent-client";
import { queueKey, getOrCreateQueue } from "./watch-processor";

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
