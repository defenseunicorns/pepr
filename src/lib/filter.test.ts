// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe } from "@jest/globals";
import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { CreatePod, DeletePod } from "../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { Event, Binding } from "./types";
import { AdmissionRequest } from "./k8s";

const callback = () => undefined;

const podKind = modelToGroupVersionKind(kind.Pod.name);

describe("Fuzzing shouldSkipRequest", () => {
  test("should handle random inputs without crashing", () => {
    fc.assert(
      fc.property(
        fc.record({
          event: fc.constantFrom("CREATE", "UPDATE", "DELETE", "ANY"),
          kind: fc.record({
            group: fc.string(),
            version: fc.string(),
            kind: fc.string(),
          }),
          filters: fc.record({
            name: fc.string(),
            namespaces: fc.array(fc.string()),
            labels: fc.dictionary(fc.string(), fc.string()),
            annotations: fc.dictionary(fc.string(), fc.string()),
          }),
        }),
        fc.record({
          operation: fc.string(),
          uid: fc.string(),
          name: fc.string(),
          namespace: fc.string(),
          kind: fc.record({
            group: fc.string(),
            version: fc.string(),
            kind: fc.string(),
          }),
        }),
        fc.array(fc.string()),
        (binding, req, capabilityNamespaces) => {
          expect(() =>
            shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
describe("Property-Based Testing shouldSkipRequest", () => {
  test("should only skip requests that do not match the binding criteria", () => {
    fc.assert(
      fc.property(
        fc.record({
          event: fc.constantFrom("CREATE", "UPDATE", "DELETE", "ANY"),
          kind: fc.record({
            group: fc.string(),
            version: fc.string(),
            kind: fc.string(),
          }),
          filters: fc.record({
            name: fc.string(),
            namespaces: fc.array(fc.string()),
            labels: fc.dictionary(fc.string(), fc.string()),
            annotations: fc.dictionary(fc.string(), fc.string()),
          }),
        }),
        fc.record({
          operation: fc.string(),
          uid: fc.string(),
          name: fc.string(),
          namespace: fc.string(),
          kind: fc.record({
            group: fc.string(),
            version: fc.string(),
            kind: fc.string(),
          }),
        }),
        fc.array(fc.string()),
        (binding, req, capabilityNamespaces) => {
          const shouldSkip = shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces);
          expect(typeof shouldSkip).toBe("boolean");
        },
      ),
      { numRuns: 100 },
    );
  });
});

test("should reject when name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "bleh",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when kind does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: modelToGroupVersionKind(kind.CronJob.name),
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when group does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: modelToGroupVersionKind(kind.CronJob.name),
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should reject when version does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: {
      group: "",
      version: "v2",
      kind: "Pod",
    },
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when group, version, and kind match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should allow when kind match and others are empty", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: {
      group: "",
      version: "",
      kind: "Pod",
    },
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when teh capability namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toBe(true);
});

test("should reject when namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: ["bleh"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when namespace is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: ["default", "unicorn", "things"],
      labels: {},
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when label does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {
        foo: "bar",
      },
      annotations: {},
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when label is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",

      namespaces: [],
      labels: {
        foo: "bar",
        test: "test1",
      },
      annotations: {},
    },
    callback,
  };

  const pod = CreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.labels = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should reject when annotation does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {
        foo: "bar",
      },
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(true);
});

test("should allow when annotation is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {
        foo: "bar",
        test: "test1",
      },
    },
    callback,
  };

  const pod = CreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});

test("should use `oldObject` when the operation is `DELETE`", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Delete,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {
        "app.kubernetes.io/name": "cool-name-podinfo",
      },
      annotations: {
        "prometheus.io/scrape": "true",
      },
    },
    callback,
  };

  const pod = DeletePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe(false);
});
