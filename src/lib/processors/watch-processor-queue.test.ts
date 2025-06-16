import { describe, beforeEach, it, expect, afterAll } from "vitest";
import { KubernetesObject } from "kubernetes-fluent-client";
import { V1ObjectMeta } from "@kubernetes/client-node";
import { queueKey, getOrCreateQueue } from "./watch-processor";

class LoggableKubernetesObject implements KubernetesObject {
  kind?: string;
  apiVersion?: string;
  metadata?: V1ObjectMeta;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;

  constructor(params: {
    kind?: string;
    metadata?: { namespace?: string; name?: string };
    description: string;
  }) {
    if (params.kind) this.kind = params.kind;
    if (params.metadata) this.metadata = params.metadata as V1ObjectMeta;
    this.toString = (): string => params.description;
  }
}

describe("Queue Key Generation", () => {
  const withKindNsName = new LoggableKubernetesObject({
    kind: "Pod",
    metadata: { namespace: "my-ns", name: "my-name" },
    description: "complete resource (kind=Pod, namespace=my-ns, name=my-name)",
  });

  const withKindNs = new LoggableKubernetesObject({
    kind: "Pod",
    metadata: { namespace: "my-ns" },
    description: "resource with namespace only (kind=Pod, namespace=my-ns)",
  });

  const withKindName = new LoggableKubernetesObject({
    kind: "Pod",
    metadata: { name: "my-name" },
    description: "resource with name only (kind=Pod, name=my-name)",
  });

  const withNsName = new LoggableKubernetesObject({
    metadata: { namespace: "my-ns", name: "my-name" },
    description: "resource without kind (namespace=my-ns, name=my-name)",
  });

  const withKind = new LoggableKubernetesObject({
    kind: "Pod",
    description: "minimal Pod resource (kind=Pod)",
  });

  const withNs = new LoggableKubernetesObject({
    metadata: { namespace: "my-ns" },
    description: "namespace only resource (namespace=my-ns)",
  });

  const withName = new LoggableKubernetesObject({
    metadata: { name: "my-name" },
    description: "name only resource (name=my-name)",
  });

  const withNone = new LoggableKubernetesObject({
    description: "empty resource",
  });

  const original = process.env.PEPR_RECONCILE_STRATEGY;

  describe("when using 'kind' strategy", () => {
    beforeEach(() => {
      process.env.PEPR_RECONCILE_STRATEGY = "kind";
    });

    it.each([
      ["Pod", withKindNsName],
      ["Pod", withKindNs],
      ["Pod", withKindName],
      ["Pod", withKind],
      ["UnknownKind", withNsName],
      ["UnknownKind", withNs],
      ["UnknownKind", withName],
      ["UnknownKind", withNone],
    ])("returns %s for %s", (expected, input) => {
      expect(queueKey(input)).toBe(expected);
    });
  });

  describe("when using 'kindNs' strategy", () => {
    beforeEach(() => {
      process.env.PEPR_RECONCILE_STRATEGY = "kindNs";
    });

    it.each([
      ["Pod/my-ns", withKindNsName],
      ["Pod/my-ns", withKindNs],
      ["Pod/cluster-scoped", withKindName],
      ["UnknownKind/my-ns", withNsName],
      ["Pod/cluster-scoped", withKind],
      ["UnknownKind/my-ns", withNs],
      ["UnknownKind/cluster-scoped", withName],
      ["UnknownKind/cluster-scoped", withNone],
    ])("returns %s for %s", (expected, input) => {
      expect(queueKey(input)).toBe(expected);
    });
  });

  describe("when using 'kindNsName' strategy", () => {
    beforeEach(() => {
      process.env.PEPR_RECONCILE_STRATEGY = "kindNsName";
    });

    it.each([
      ["Pod/my-ns/my-name", withKindNsName],
      ["Pod/my-ns/Unnamed", withKindNs],
      ["Pod/cluster-scoped/my-name", withKindName],
      ["UnknownKind/my-ns/my-name", withNsName],
      ["Pod/cluster-scoped/Unnamed", withKind],
      ["UnknownKind/my-ns/Unnamed", withNs],
      ["UnknownKind/cluster-scoped/my-name", withName],
      ["UnknownKind/cluster-scoped/Unnamed", withNone],
    ])("returns %s for %s", (expected, input) => {
      expect(queueKey(input)).toBe(expected);
    });
  });

  describe("when using 'global' strategy", () => {
    beforeEach(() => {
      process.env.PEPR_RECONCILE_STRATEGY = "global";
    });

    it.each([
      [withKindNsName],
      [withKindNs],
      [withKindName],
      [withNsName],
      [withKind],
      [withNs],
      [withName],
      [withNone],
    ])("returns 'global' for %s", input => {
      expect(queueKey(input)).toBe("global");
    });
  });

  afterAll(() => {
    process.env.PEPR_RECONCILE_STRATEGY = original;
  });
});

describe("Queue Management", () => {
  describe("Queue Creation", () => {
    it("initializes new Queue on first access", () => {
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

    it("returns existing Queue on subsequent access", () => {
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
});
