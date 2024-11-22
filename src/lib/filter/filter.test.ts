// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe } from "@jest/globals";
import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { AdmissionRequestCreatePod, AdmissionRequestDeletePod } from "../../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { AdmissionRequest, Binding } from "../types";
import { Event } from "../enums";

export const callback = () => undefined;

export const podKind = modelToGroupVersionKind(kind.Pod.name);

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
          const shouldSkip = shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces);
          expect(typeof shouldSkip).toBe("string");
        },
      ),
      { numRuns: 100 },
    );
  });
});

test("create: should reject when regex name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "^default$",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestCreatePod();
  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines name regex '.*' but Object carries '.*'./,
  );
});

test("create: should not reject when regex name does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "^cool",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestCreatePod();
  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("delete: should reject when regex name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "^default$",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestDeletePod();
  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines name regex '.*' but Object carries '.*'./,
  );
});

test("delete: should not reject when regex name does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "^cool",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestDeletePod();
  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("create: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: ["^helm"],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestCreatePod();
  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("create: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: ["^argo"],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestCreatePod();
  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines namespace regexes '.*' but Object carries '.*'./,
  );
});

test("delete: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: ["^argo"],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestDeletePod();
  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines namespace regexes '.*' but Object carries '.*'./,
  );
});

test("delete: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: ["^helm"],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestDeletePod();
  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("delete: should reject when name does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "bleh",
      namespaces: [],
      regexNamespaces: [],
      regexName: "^not-cool",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    callback,
  };
  const pod = AdmissionRequestDeletePod();
  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines name '.*' but Object carries '.*'./,
  );
});

test("should reject when kind does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: {
      group: "",
      version: "v1",
      kind: "Nope",
    },
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines kind '.*' but Request declares '.*'./,
  );
});

test("should reject when group does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: {
      group: "Nope",
      version: "v1",
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines group '.*' but Request declares '.*'./,
  );
});

test("should reject when version does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: {
      group: "",
      version: "Nope",
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines version '.*' but Request declares '.*'./,
  );
});

test("should allow when group, version, and kind match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should allow when kind match and others are empty", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should reject when the capability namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toMatch(
    /Ignoring Admission Callback: Object carries namespace '.*' but namespaces allowed by Capability are '.*'./,
  );
});

test("should reject when namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines namespaces '.*' but Object carries '.*'./,
  );
});

test("should allow when namespace is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: ["helm-releasename", "unicorn", "things"],
      labels: {},
      annotations: {},
      deletionTimestamp: false,
      regexNamespaces: [],
      regexName: "",
    },
    callback,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should reject when label does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines labels '.*' but Object carries '.*'./,
  );
});

test("should allow when label is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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

  const pod = AdmissionRequestCreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.labels = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should reject when annotation does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines annotations '.*' but Object carries '.*'./,
  );
});

test("should allow when annotation is match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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

  const pod = AdmissionRequestCreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should use `oldObject` when the operation is `DELETE`", () => {
  const binding = {
    model: kind.Pod,
    event: Event.DELETE,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [],
      regexName: "",
      deletionTimestamp: false,
      labels: {
        "test-op": "delete",
      },
      annotations: {},
    },
    callback,
  };

  const pod = AdmissionRequestDeletePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should allow when deletionTimestamp is present on pod", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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

  const pod = AdmissionRequestCreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata!.deletionTimestamp = new Date("2021-09-01T00:00:00Z");
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

test("should reject when deletionTimestamp is not present on pod", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
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

  const pod = AdmissionRequestCreatePod();
  pod.object.metadata = pod.object.metadata || {};
  pod.object.metadata.annotations = {
    foo: "bar",
    test: "test1",
    test2: "test2",
  };

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines deletionTimestamp but Object does not carry it./,
  );
});
