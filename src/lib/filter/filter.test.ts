// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, describe } from "@jest/globals";
import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { AdmissionRequestCreatePod, AdmissionRequestDeletePod } from "../../fixtures/loader";
import {
  shouldSkipRequest,
  adjudicateMisboundDeleteWithDeletionTimestamp,
  adjudicateMismatchedDeletionTimestamp,
  adjudicateMismatchedEvent,
  adjudicateMismatchedNameRegex,
  adjudicateMismatchedName,
  adjudicateMismatchedGroup,
  adjudicateMismatchedVersion,
  adjudicateMismatchedKind,
  adjudicateUnbindableNamespaces,
  adjudicateUncarryableNamespace,
  adjudicateMismatchedNamespace,
  adjudicateMismatchedLabels,
  adjudicateMismatchedAnnotations,
  adjudicateMismatchedNamespaceRegex,
  adjudicateCarriesIgnoredNamespace,
  adjudicateMissingCarriableNamespace,
} from "./filter";
import { AdmissionRequest, Binding } from "../types";
import { Event, Operation } from "../enums";
import { clusterScopedBinding } from "../helpers.test";
import { defaultAdmissionRequest, defaultBinding } from "./adjudicators/defaultTestObjects";
const callback = () => undefined;

const podKind = modelToGroupVersionKind(kind.Pod.name);

describe("Fuzzing shouldSkipRequest", () => {
  it("should handle random inputs without crashing", () => {
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
  it("should only skip requests that do not match the binding criteria", () => {
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

it("create: should reject when regex name does not match", () => {
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

it("create: should not reject when regex name does match", () => {
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

it("delete: should reject when regex name does not match", () => {
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

it("delete: should not reject when regex name does match", () => {
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

it("create: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp("^helm").source],
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

it("create: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp("^argo").source],
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

it("delete: should reject when regex namespace does not match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp("^argo").source],
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

it("delete: should not reject when regex namespace does match", () => {
  const binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: podKind,
    filters: {
      name: "",
      namespaces: [],
      regexNamespaces: [new RegExp("^helm").source],
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

it("delete: should reject when name does not match", () => {
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

it("should reject when kind does not match", () => {
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

it("should reject when group does not match", () => {
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

it("should reject when version does not match", () => {
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

it("should allow when group, version, and kind match", () => {
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

it("should allow when kind match and others are empty", () => {
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

it("should reject when the capability namespace does not match", () => {
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

it("should reject when namespace does not match", () => {
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

it("should allow when namespace is match", () => {
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

it("should reject when label does not match", () => {
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

it("should allow when label is match", () => {
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

it("should reject when annotation does not match", () => {
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

it("should allow when annotation is match", () => {
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

it("should use `oldObject` when the operation is `DELETE`", () => {
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

it("should allow when deletionTimestamp is present on pod", () => {
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

it("should reject when deletionTimestamp is not present on pod", () => {
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

describe("adjudicateMisboundDeleteWithDeletionTimestamp", () => {
  it("should return misboundDeleteWithDeletionTimestamp reason when using a deletionTimestamp filter on a DELETE operation", () => {
    const result = adjudicateMisboundDeleteWithDeletionTimestamp({
      ...clusterScopedBinding,
      filters: {
        ...clusterScopedBinding.filters,
        deletionTimestamp: true,
      },
    });
    expect(result).toBe(`Cannot use deletionTimestamp filter on a DELETE operation.`);
  });

  it("should return null when not using a deletionTimestamp filter on a DELETE operation", () => {
    const result = adjudicateMisboundDeleteWithDeletionTimestamp(clusterScopedBinding);
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedDeletionTimestamp", () => {
  it("should return mismatchedDeletionTimestamp reason when the binding has a deletionTimestamp and the object does not", () => {
    const result = adjudicateMismatchedDeletionTimestamp(
      {
        ...clusterScopedBinding,
        filters: {
          ...clusterScopedBinding.filters,
          deletionTimestamp: true,
        },
      },
      {},
    );
    expect(result).toBe(`Binding defines deletionTimestamp but Object does not carry it.`);
  });
  it("should return null when the binding and object both define deletionTimestamp", () => {
    const result = adjudicateMismatchedDeletionTimestamp(
      {
        ...clusterScopedBinding,
        filters: {
          ...clusterScopedBinding.filters,
          deletionTimestamp: true,
        },
      },
      { metadata: { deletionTimestamp: new Date() } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedEvent", () => {
  it("should return mismatchedEvent reason when the binding event does not match the request event", () => {
    const result = adjudicateMismatchedEvent(clusterScopedBinding, defaultAdmissionRequest);
    expect(result).toBe(`Binding defines event 'DELETE' but Request declares 'CONNECT'.`);
  });
  it("should not return mismatchedEvent reason when the binding event and request event match", () => {
    const result = adjudicateMismatchedEvent(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      operation: Operation.DELETE,
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedName", () => {
  it("should return mismatchedName reason when the binding name does not match the object name", () => {
    const result = adjudicateMismatchedName(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, name: "default" } },
      { metadata: { name: "not-default" } },
    );
    expect(result).toBe(`Binding defines name 'default' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedName reason when the binding name and object name match", () => {
    const result = adjudicateMismatchedName(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, name: "default" } },
      { metadata: { name: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedGroup", () => {
  it("should return mismatchedGroup reason when the binding group does not match the request group", () => {
    const result = adjudicateMismatchedGroup(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, group: "other-group" },
    });
    expect(result).toBe(`Binding defines group 'rbac.authorization.k8s.io' but Request declares 'other-group'.`);
  });
  it("should not return mismatchedGroup reason when the binding group and request group match", () => {
    const result = adjudicateMismatchedGroup(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, group: "rbac.authorization.k8s.io" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedVersion", () => {
  it("should return mismatchedVersion reason when the binding version does not match the request version", () => {
    const result = adjudicateMismatchedVersion(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, version: "other-version" },
    });
    expect(result).toBe(`Binding defines version 'v1' but Request declares 'other-version'.`);
  });
  it("should not return mismatchedVersion reason when the binding version and request version match", () => {
    const result = adjudicateMismatchedVersion(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, version: "v1" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedKind", () => {
  it("should return mismatchedKind reason when the binding kind does not match the request kind", () => {
    const result = adjudicateMismatchedKind(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, kind: "other-kind" },
    });
    expect(result).toBe(`Binding defines kind 'ClusterRole' but Request declares 'other-kind'.`);
  });
  it("should not return mismatchedKind reason when the binding kind and request kind match", () => {
    const result = adjudicateMismatchedKind(clusterScopedBinding, {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, kind: "ClusterRole" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateUnbindableNamespaces", () => {
  it("should return unbindableNamespaces reason when the object carries a namespace that is not allowed by the capability", () => {
    const result = adjudicateUnbindableNamespaces(["default"], {
      ...defaultBinding,
      filters: { ...defaultBinding.filters, namespaces: ["kube-system"] },
    });
    expect(result).toBe(
      `Binding defines namespaces ["kube-system"] but namespaces allowed by Capability are '["default"]'.`,
    );
  });
  it("should not return unbindableNamespaces reason when the object carries a namespace that is allowed by the capability", () => {
    const result = adjudicateUnbindableNamespaces(["default", "kube-system"], {
      ...defaultBinding,
      filters: { ...defaultBinding.filters, namespaces: ["kube-system"] },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateUncarryableNamespace", () => {
  it("should return uncarryableNamespace reason when the object carries a namespace that is not allowed by the capability", () => {
    const result = adjudicateUncarryableNamespace(["default"], { metadata: { namespace: "kube-system" } });
    expect(result).toBe(
      `Object carries namespace 'kube-system' but namespaces allowed by Capability are '["default"]'.`,
    );
  });
  it("should not return uncarryableNamespace reason when the object carries a namespace that is allowed by the capability", () => {
    const result = adjudicateUncarryableNamespace(["default", "kube-system"], {
      metadata: { namespace: "kube-system" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNamespace", () => {
  it("should return mismatchedNamespace reason when the binding namespace does not match the object namespace", () => {
    const result = adjudicateMismatchedNamespace(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, namespaces: ["kube-system"] } },
      { metadata: { namespace: "default" } },
    );
    expect(result).toBe(`Binding defines namespaces '["kube-system"]' but Object carries 'default'.`);
  });
  it("should not return mismatchedNamespace reason when the binding namespace and object namespace match", () => {
    const result = adjudicateMismatchedNamespace(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, namespaces: ["default"] } },
      { metadata: { namespace: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedLabels", () => {
  it("should return mismatchedLabels reason when the binding labels do not match the object labels", () => {
    const result = adjudicateMismatchedLabels(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, labels: { foo: "bar" } } },
      { metadata: { labels: { foo: "not-bar" } } },
    );
    expect(result).toBe(`Binding defines labels '{"foo":"bar"}' but Object carries '{"foo":"not-bar"}'.`);
  });
  it("should not return mismatchedLabels reason when the binding labels and object labels match", () => {
    const result = adjudicateMismatchedLabels(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, labels: { foo: "bar" } } },
      { metadata: { labels: { foo: "bar" } } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedAnnotations", () => {
  it("should return mismatchedAnnotations reason when the binding annotations do not match the object annotations", () => {
    const result = adjudicateMismatchedAnnotations(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, annotations: { foo: "bar" } } },
      { metadata: { annotations: { foo: "not-bar" } } },
    );
    expect(result).toBe(`Binding defines annotations '{"foo":"bar"}' but Object carries '{"foo":"not-bar"}'.`);
  });
  it("should not return mismatchedAnnotations reason when the binding annotations and object annotations match", () => {
    const result = adjudicateMismatchedAnnotations(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, annotations: { foo: "bar" } } },
      { metadata: { annotations: { foo: "bar" } } },
    );
    expect(result).toBe(null);
  });
});
describe("adjudicateMismatchedNameRegex", () => {
  it("should return mismatchedNameRegex reason when the binding regexName does not match the object name", () => {
    const result = adjudicateMismatchedNameRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexName: "^default$" } },
      { metadata: { name: "not-default" } },
    );
    expect(result).toBe(`Binding defines name regex '^default$' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedNameRegex reason when the binding regexName and object name match", () => {
    const result = adjudicateMismatchedNameRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexName: "^default$" } },
      { metadata: { name: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNameRegex", () => {
  it("should return mismatchedNameRegex reason when the binding regexName does not match the object name", () => {
    const result = adjudicateMismatchedNameRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexName: "^default$" } },
      { metadata: { name: "not-default" } },
    );
    expect(result).toBe(`Binding defines name regex '^default$' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedNameRegex reason when the binding regexName and object name match", () => {
    const result = adjudicateMismatchedNameRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexName: "^default$" } },
      { metadata: { name: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateCarriesIgnoredNamespace", () => {
  it("should return carriesIgnoredNamespace reason when the object carries a namespace that is in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["default"], { metadata: { namespace: "default" } });
    expect(result).toBe(`Object carries namespace 'default' but ignored namespaces include '["default"]'.`);
  });
  it("should not return carriesIgnoredNamespace reason when the object carries a namespace that is not in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["kube-system"], { metadata: { namespace: "default" } });
    expect(result).toBe(null);
  });
});

describe("adjudicateMissingCarriableNamespace", () => {
  it("should return missingCarriableNamespace reason when the object does not carry a namespace and the capability does not allow it", () => {
    const result = adjudicateMissingCarriableNamespace(["default"], { metadata: {} });
    expect(result).toBe(`Object does not carry a namespace but namespaces allowed by Capability are '["default"]'.`);
  });
  it("should not return missingCarriableNamespace reason when the object carries a namespace that is allowed by the capability", () => {
    const result = adjudicateMissingCarriableNamespace(["default"], { metadata: { namespace: "default" } });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNamespaceRegex", () => {
  it("should return mismatchedNamespaceRegex reason when the binding regexNamespaces do not match the object namespace", () => {
    const result = adjudicateMismatchedNamespaceRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexNamespaces: ["^default$"] } },
      { metadata: { namespace: "not-default" } },
    );
    expect(result).toBe(`Binding defines namespace regexes '["^default$"]' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedNamespaceRegex reason when the binding regexNamespaces and object namespace match", () => {
    const result = adjudicateMismatchedNamespaceRegex(
      { ...clusterScopedBinding, filters: { ...clusterScopedBinding.filters, regexNamespaces: ["^default$"] } },
      { metadata: { namespace: "default" } },
    );
    expect(result).toBe(null);
  });
});
