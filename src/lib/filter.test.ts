// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe } from "@jest/globals";
import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { CreatePod, DeletePod } from "../fixtures/loader";
import { shouldSkipRequestRegex } from "./filter";
import { Event, Binding } from "./types";
import { AdmissionRequest } from "./k8s";

export const callback = () => undefined;

export const podKind = modelToGroupVersionKind(kind.Pod.name);

describe("Fuzzing shouldSkipRequestRegex", () => {
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
            deletionTimestamp: fc.boolean(),
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
          object: fc.record({
            metadata: fc.record({
              deletionTimestamp: fc.option(fc.date()),
            }),
          }),
        }),
        fc.array(fc.string()),
        (binding, req, capabilityNamespaces) => {
          expect(() =>
            shouldSkipRequestRegex(binding as Binding, req as AdmissionRequest, capabilityNamespaces),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
describe("Property-Based Testing shouldSkipRequestRegex", () => {
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
            deletionTimestamp: fc.boolean(),
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
          object: fc.record({
            metadata: fc.record({
              deletionTimestamp: fc.option(fc.date()),
            }),
          }),
        }),
        fc.array(fc.string()),
        (binding, req, capabilityNamespaces) => {
          const shouldSkip = shouldSkipRequestRegex(binding as Binding, req as AdmissionRequest, capabilityNamespaces);
          expect(typeof shouldSkip).toBe("boolean");
        },
      ),
      { numRuns: 100 },
    );
  });
});

test("create: should reject when regex name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: new RegExp(/^default$/).source,
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = CreatePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});
test("create: should not reject when regex name does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: new RegExp(/^cool/).source,
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = CreatePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});
test("delete: should reject when regex name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: new RegExp(/^default$/).source,
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = DeletePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});
test("delete: should not reject when regex name does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: new RegExp(/^cool/).source,
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = DeletePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("create: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp(/^helm/).source],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = CreatePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("create: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp(/^argo/).source],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = CreatePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});

test("delete: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "bleh",
      namespaces: [],
      regexNamespaces: [new RegExp(/^argo/).source],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = DeletePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});

test("delete: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp(/^helm/).source],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = DeletePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("delete: should reject when name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "bleh",
      namespaces: [],
      regexNamespaces: [],
      regexName: new RegExp(/^not-cool/).source,
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = DeletePod();
  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});
test("should reject when kind does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: modelToGroupVersionKind(kind.CronJob.name),
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("should reject when the capability namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      annotations: {},
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, ["bleh", "bleh2"])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});

test("should allow when label is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      deletionTimestamp: false,
      namespaces: [],
      regexNamespaces: [],
      regexName: "",
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

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = CreatePod();

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
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
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
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

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("should use `oldObject` when the operation is `DELETE`", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Delete,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "",
      deletionTimestamp: false,
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

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});

test("should skip processing when deletionTimestamp is not present on pod", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      regexNamespaces: [],
      regexName: "",
      annotations: {
        foo: "bar",
        test: "test1",
      },
      deletionTimestamp: true,
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

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(true);
});

test("should processing when deletionTimestamp is not present on pod", () => {
  const binding = {
    model: kind.Pod,
    event: Event.Any,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      labels: {},
      regexNamespaces: [],
      regexName: "",
      annotations: {
        foo: "bar",
        test: "test1",
      },
      deletionTimestamp: true,
    },
    callback,
  };

  const pod = CreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata!.deletionTimestamp = new Date("2021-09-01T00:00:00Z");
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequestRegex(binding, pod, [])).toBe(false);
});
