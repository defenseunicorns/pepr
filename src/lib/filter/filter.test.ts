// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, describe } from "@jest/globals";
import { kind, KubernetesObject, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { clone } from "ramda";
import { AdmissionRequestCreatePod, AdmissionRequestDeletePod } from "../../fixtures/loader";
import {
  adjudicateCarriesIgnoredNamespace,
  adjudicateMisboundDeleteWithDeletionTimestamp,
  adjudicateMisboundNamespace,
  adjudicateMismatchedAnnotations,
  adjudicateMismatchedDeletionTimestamp,
  adjudicateMismatchedEvent,
  adjudicateMismatchedGroup,
  adjudicateMismatchedKind,
  adjudicateMismatchedLabels,
  adjudicateMismatchedName,
  adjudicateMismatchedNameRegex,
  adjudicateMismatchedNamespace,
  adjudicateMismatchedNamespaceRegex,
  adjudicateMismatchedVersion,
  adjudicateMissingCarriableNamespace,
  adjudicateUnbindableNamespaces,
  adjudicateUncarryableNamespace,
  filterNoMatchReason,
  shouldSkipRequest,
} from "./filter";
import { AdmissionRequest, Binding } from "../types";
import { Event, Operation } from "../enums";
import {
  defaultAdmissionRequest,
  defaultBinding,
  defaultFilters,
  defaultKubernetesObject,
} from "./adjudicators/defaultTestObjects";

const callback = () => undefined;

const kindSchema = fc.record({
  group: fc.string(),
  version: fc.string(),
  kind: fc.string(),
});

const filtersSchema = fc.record({
  name: fc.string(),
  namespaces: fc.array(fc.string()),
  labels: fc.dictionary(fc.string(), fc.string()),
  annotations: fc.dictionary(fc.string(), fc.string()),
  deletionTimestamp: fc.boolean(),
});

const bindingSchema = fc.record({
  event: fc.constantFrom("CREATE", "UPDATE", "DELETE", "ANY"),
  kind: kindSchema,
  filters: filtersSchema,
});

const requestSchema = fc.record({
  operation: fc.string(),
  uid: fc.string(),
  name: fc.string(),
  namespace: fc.string(),
  kind: kindSchema,
  object: fc.record({
    metadata: fc.record({
      deletionTimestamp: fc.option(fc.date()),
    }),
  }),
});

type ExtendedBinding = Partial<Omit<Binding, "filters">> & {
  filters?: Partial<Binding["filters"]>;
  callback: () => void;
};

const createBinding = (overrides: Partial<ExtendedBinding> = {}) => {
  const {
    model = kind.Pod,
    event = Event.ANY,
    kind: bindingKind = podKind,
    filters: {
      name = "",
      namespaces = [],
      regexNamespaces = [],
      regexName = "",
      labels = {},
      annotations = {},
      deletionTimestamp = false,
    } = {},
    callback = () => {},
    ...rest
  } = overrides;

  return {
    model,
    event,
    kind: bindingKind,
    filters: { name, namespaces, regexNamespaces, regexName, labels, annotations, deletionTimestamp },
    callback,
    ...rest,
  };
};

describe("shouldSkipRequest", () => {
  describe("Fuzzing shouldSkipRequest", () => {
    it("should handle random inputs without crashing", () => {
      fc.assert(
        fc.property(bindingSchema, requestSchema, fc.array(fc.string()), (binding, req, capabilityNamespaces) => {
          expect(() =>
            shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces),
          ).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("Property-Based Testing shouldSkipRequest", () => {
    it("should only skip requests that do not match the binding criteria", () => {
      fc.assert(
        fc.property(bindingSchema, requestSchema, fc.array(fc.string()), (binding, req, capabilityNamespaces) => {
          const shouldSkip = shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces);
          expect(typeof shouldSkip).toBe("string");
        }),
        { numRuns: 100 },
      );
    });
  });

  it("create: should reject when regex name does not match", () => {
    const binding = createBinding({
      filters: { regexName: "^default$" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name regex '.*' but Object carries '.*'./,
    );
  });

  it("create: should not reject when regex name does match", () => {
    const binding = createBinding({
      filters: { regexName: "^cool" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("delete: should reject when regex name does not match", () => {
    const binding = createBinding({
      filters: { regexName: "^default$" },
      callback,
    });

    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name regex '.*' but Object carries '.*'./,
    );
  });

  it("delete: should not reject when regex name does match", () => {
    const binding = createBinding({
      filters: { regexName: "^cool" },
      callback,
    });

    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("create: should not reject when regex namespace does match", () => {
    const binding = createBinding({
      filters: { regexNamespaces: [new RegExp("^helm").source] },
      callback,
    });

    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("create: should reject when regex namespace does not match", () => {
    const binding = createBinding({
      filters: { regexNamespaces: [new RegExp("^argo").source] },
      callback,
    });

    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespace regexes '.*' but Object carries '.*'./,
    );
  });

  it("delete: should reject when regex namespace does not match", () => {
    const binding = createBinding({
      filters: { regexNamespaces: [new RegExp("^argo").source] },
      callback,
    });

    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespace regexes '.*' but Object carries '.*'./,
    );
  });

  it("delete: should not reject when regex namespace does match", () => {
    const binding = createBinding({
      filters: { regexNamespaces: [new RegExp("^helm").source] },
      callback,
    });

    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("delete: should reject when name does not match", () => {
    const binding = createBinding({
      filters: { regexName: "^not-cool", name: "bleh" },
      callback,
    });

    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name '.*' but Object carries '.*'./,
    );
  });

  it("should reject when kind does not match", () => {
    const binding = createBinding({
      kind: { version: "v1", kind: "Nope", group: "" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines kind '.*' but Request declares '.*'./,
    );
  });

  it("should reject when group does not match", () => {
    const binding = createBinding({
      kind: { version: "v1", kind: "Pod", group: "Nope" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines group '.*' but Request declares '.*'./,
    );
  });

  it("should reject when version does not match", () => {
    const binding = createBinding({
      kind: { version: "Nope", kind: "Pod", group: "" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines version '.*' but Request declares '.*'./,
    );
  });

  it("should allow when group, version, and kind match", () => {
    const binding = createBinding({
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should allow when kind match and others are empty", () => {
    const binding = createBinding({
      kind: { version: "", kind: "Pod", group: "" },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should reject when the capability namespace does not match", () => {
    const binding = createBinding({
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toMatch(
      /Ignoring Admission Callback: Object carries namespace '.*' but namespaces allowed by Capability are '.*'./,
    );
  });

  it("should reject when namespace does not match", () => {
    const binding = createBinding({
      filters: { namespaces: ["bleh"] },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespaces '.*' but Object carries '.*'./,
    );
  });

  it("should allow when namespace is match", () => {
    const binding = createBinding({
      filters: { namespaces: ["helm-releasename", "unicorn", "things"] },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should reject when label does not match", () => {
    const binding = createBinding({
      filters: {
        labels: {
          foo: "bar",
        },
      },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines labels '.*' but Object carries '.*'./,
    );
  });

  it("should allow when label is match", () => {
    const binding = createBinding({
      filters: {
        labels: {
          foo: "bar",
          test: "test1",
        },
      },
      callback,
    });

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
    const binding = createBinding({
      filters: {
        annotations: {
          foo: "bar",
        },
      },
      callback,
    });

    const pod = AdmissionRequestCreatePod();

    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines annotations '.*' but Object carries '.*'./,
    );
  });

  it("should allow when annotation is match", () => {
    const binding = createBinding({
      filters: {
        annotations: {
          foo: "bar",
          test: "test1",
        },
      },
      callback,
    });

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
    const binding = createBinding({
      filters: {
        labels: {
          "test-op": "delete",
        },
      },
      callback,
    });

    const pod = AdmissionRequestDeletePod();

    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should allow when deletionTimestamp is present on pod", () => {
    const binding = createBinding({
      filters: {
        annotations: {
          foo: "bar",
          test: "test1",
        },
        deletionTimestamp: true,
      },
      callback,
    });

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
    const binding = createBinding({
      filters: {
        annotations: {
          foo: "bar",
          test: "test1",
        },
        deletionTimestamp: true,
      },
      callback,
    });

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
});

export const podKind = modelToGroupVersionKind(kind.Pod.name);
export const deploymentKind = modelToGroupVersionKind(kind.Deployment.name);
export const clusterRoleKind = modelToGroupVersionKind(kind.ClusterRole.name);

export const groupBinding: Binding = {
  event: Event.CREATE,
  filters: defaultFilters,
  kind: deploymentKind,
  model: kind.Deployment,
};

export const clusterScopedBinding: Binding = {
  event: Event.DELETE,
  filters: defaultFilters,
  kind: clusterRoleKind,
  model: kind.ClusterRole,
};

describe("filterNoMatchReason", () => {
  it.each([
    [{}],
    [{ metadata: { namespace: "pepr-uds" } }],
    [{ metadata: { namespace: "pepr-core" } }],
    [{ metadata: { namespace: "uds-ns" } }],
    [{ metadata: { namespace: "uds" } }],
  ])(
    "given %j, it returns regex namespace filter error for Pods whose namespace does not match the regex",
    (obj: KubernetesObject) => {
      const kubernetesObject: KubernetesObject = obj.metadata
        ? {
            ...defaultKubernetesObject,
            metadata: { ...defaultKubernetesObject.metadata, namespace: obj.metadata.namespace },
          }
        : { ...defaultKubernetesObject, metadata: obj as unknown as undefined };
      const binding: Binding = {
        ...defaultBinding,
        kind: { kind: "Pod", group: "some-group" },
        filters: { ...defaultFilters, regexNamespaces: [new RegExp("(.*)-system").source] },
      };

      const capabilityNamespaces: string[] = [];
      const expectedErrorMessage = `Ignoring Watch Callback: Binding defines namespace regexes '["(.*)-system"]' but Object carries`;
      const result = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces);
      expect(result).toEqual(
        typeof kubernetesObject.metadata === "object" && obj !== null && Object.keys(obj).length > 0
          ? `${expectedErrorMessage} '${kubernetesObject.metadata.namespace}'.`
          : `${expectedErrorMessage} ''.`,
      );
    },
  );

  describe("when pod namespace matches the namespace regex", () => {
    it.each([["pepr-system"], ["pepr-uds-system"], ["uds-system"], ["some-thing-that-is-a-system"], ["your-system"]])(
      "should not return an error message (namespace: '%s')",
      namespace => {
        const binding: Binding = {
          ...defaultBinding,
          kind: { kind: "Pod", group: "some-group" },
          filters: {
            ...defaultFilters,
            regexName: "",
            regexNamespaces: [new RegExp("(.*)-system").source],
            namespaces: [],
          },
        };
        const kubernetesObject: KubernetesObject = { ...defaultKubernetesObject, metadata: { namespace: namespace } };
        const capabilityNamespaces: string[] = [];
        const result = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces);
        expect(result).toEqual("");
      },
    );
  });

  // Names Fail
  it("returns regex name filter error for Pods whos name does not match the regex", () => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: "Pod", group: "some-group" },
      filters: { ...defaultFilters, regexName: "^system", namespaces: [] },
    };
    const obj = { metadata: { name: "pepr-demo" } };
    const objArray = [
      { ...obj },
      { ...obj, metadata: { name: "pepr-uds" } },
      { ...obj, metadata: { name: "pepr-core" } },
      { ...obj, metadata: { name: "uds-ns" } },
      { ...obj, metadata: { name: "uds" } },
    ];
    const capabilityNamespaces: string[] = [];
    objArray.map(object => {
      const result = filterNoMatchReason(binding, object as unknown as Partial<KubernetesObject>, capabilityNamespaces);
      expect(result).toEqual(
        `Ignoring Watch Callback: Binding defines name regex '^system' but Object carries '${object?.metadata?.name}'.`,
      );
    });
  });

  // Names Pass
  it("returns no regex name filter error for Pods whos name does match the regex", () => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: "Pod", group: "some-group" },
      filters: { ...defaultFilters, regexName: "^system" },
    };
    const obj = { metadata: { name: "pepr-demo" } };
    const objArray = [
      { ...obj, metadata: { name: "systemd" } },
      { ...obj, metadata: { name: "systemic" } },
      { ...obj, metadata: { name: "system-of-kube-apiserver" } },
      { ...obj, metadata: { name: "system" } },
      { ...obj, metadata: { name: "system-uds" } },
    ];
    const capabilityNamespaces: string[] = [];
    objArray.map(object => {
      const result = filterNoMatchReason(binding, object as unknown as Partial<KubernetesObject>, capabilityNamespaces);
      expect(result).toEqual(``);
    });
  });

  describe("when capability namespaces are present", () => {
    it("should return missingCarriableNamespace filter error for cluster-scoped objects", () => {
      const binding: Binding = {
        ...defaultBinding,
        filters: { ...defaultFilters, regexName: "" },
        kind: { kind: "ClusterRole", group: "some-group" },
      };
      const obj: KubernetesObject = {
        kind: "ClusterRole",
        apiVersion: "rbac.authorization.k8s.io/v1",
        metadata: { name: "clusterrole1" },
      };
      const capabilityNamespaces: string[] = ["monitoring"];
      const result = filterNoMatchReason(binding, obj, capabilityNamespaces);
      expect(result).toEqual(
        "Ignoring Watch Callback: Object does not carry a namespace but namespaces allowed by Capability are '[\"monitoring\"]'.",
      );
    });
  });

  it("returns mismatchedNamespace filter error for clusterScoped objects with namespace filters", () => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: "ClusterRole", group: "some-group" },
      filters: { ...defaultFilters, namespaces: ["ns1"] },
    };
    const obj = {
      kind: "ClusterRole",
      apiVersion: "rbac.authorization.k8s.io/v1",
      metadata: { name: "clusterrole1" },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual("Ignoring Watch Callback: Binding defines namespaces '[\"ns1\"]' but Object carries ''.");
  });

  it("returns namespace filter error for namespace objects with namespace filters", () => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: "Namespace", group: "some-group" },
      filters: { ...defaultFilters, namespaces: ["ns1"] },
    };
    const obj = {};
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual("Ignoring Watch Callback: Cannot use namespace filter on a namespace object.");
  });

  it("return an Ignoring Watch Callback string if the binding name and object name are different", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, name: "pepr" },
    };
    const obj = {
      metadata: {
        name: "not-pepr",
      },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(`Ignoring Watch Callback: Binding defines name 'pepr' but Object carries 'not-pepr'.`);
  });

  describe("when the binding name and KubernetesObject name are the same", () => {
    it("should not return an Ignoring Watch Callback message", () => {
      const binding: Binding = {
        ...defaultBinding,
        filters: { ...defaultFilters, regexName: "", name: "pepr" },
      };
      const obj: KubernetesObject = {
        metadata: { name: "pepr" },
      };
      const capabilityNamespaces: string[] = [];
      const result = filterNoMatchReason(binding, obj, capabilityNamespaces);
      expect(result).toEqual("");
    });
  });

  it("return deletionTimestamp error when there is no deletionTimestamp in the object", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, deletionTimestamp: true },
    };
    const obj = {
      metadata: {},
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp but Object does not carry it.");
  });

  it("return no deletionTimestamp error when there is a deletionTimestamp in the object", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, deletionTimestamp: true },
    };
    const obj = {
      metadata: {
        deletionTimestamp: "2021-01-01T00:00:00Z",
      },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).not.toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp Object does not carry it.");
  });

  it("returns label overlap error when there is no overlap between binding and object labels", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, labels: { key: "value" } },
    };
    const obj = {
      metadata: { labels: { anotherKey: "anotherValue" } },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines labels '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
    );
  });

  it("returns annotation overlap error when there is no overlap between binding and object annotations", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, annotations: { key: "value" } },
    };
    const obj = {
      metadata: { annotations: { anotherKey: "anotherValue" } },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines annotations '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
    );
  });

  it("returns capability namespace error when object is not in capability namespaces", () => {
    const binding: Binding = {
      model: kind.Pod,
      event: Event.ANY,
      kind: {
        group: "",
        version: "v1",
        kind: "Pod",
      },
      filters: {
        name: "bleh",
        namespaces: [],
        regexNamespaces: [],
        regexName: "",
        labels: {},
        annotations: {},
        deletionTimestamp: false,
      },
      watchCallback: callback,
    };

    const obj = {
      metadata: { namespace: "ns2", name: "bleh" },
    };
    const capabilityNamespaces = ["ns1"];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(
      `Ignoring Watch Callback: Object carries namespace 'ns2' but namespaces allowed by Capability are '["ns1"]'.`,
    );
  });

  it("returns binding namespace error when filter namespace is not part of capability namespaces", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, namespaces: ["ns3"], regexNamespaces: [] },
    };
    const obj = {};
    const capabilityNamespaces = ["ns1", "ns2"];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines namespaces ["ns3"] but namespaces allowed by Capability are '["ns1","ns2"]'.`,
    );
  });

  it("returns binding and object namespace error when they do not overlap", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, namespaces: ["ns1"], regexNamespaces: [] },
    };
    const obj = {
      metadata: { namespace: "ns2" },
    };
    const capabilityNamespaces = ["ns1", "ns2"];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(`Ignoring Watch Callback: Binding defines namespaces '["ns1"]' but Object carries 'ns2'.`);
  });

  describe("when a KubernetesObject is in an ingnored namespace", () => {
    it("should return a watch violation message", () => {
      const binding: Binding = {
        ...defaultBinding,
        filters: { ...defaultFilters, regexName: "", namespaces: ["ns3"] },
      };
      const kubernetesObject: KubernetesObject = {
        ...defaultKubernetesObject,
        metadata: { namespace: "ns3" },
      };
      const capabilityNamespaces = ["ns3"];
      const ignoredNamespaces = ["ns3"];
      const result = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces, ignoredNamespaces);
      expect(result).toEqual(
        `Ignoring Watch Callback: Object carries namespace 'ns3' but ignored namespaces include '["ns3"]'.`,
      );
    });
  });

  it("returns empty string when all checks pass", () => {
    const binding: Binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        regexName: "",
        namespaces: ["ns1"],
        labels: { key: "value" },
        annotations: { key: "value" },
      },
    };
    const obj = {
      metadata: { namespace: "ns1", labels: { key: "value" }, annotations: { key: "value" } },
    };
    const capabilityNamespaces = ["ns1"];
    const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual("");
  });
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
  it("should return uncarryableNamespace reason when the object is a namespace that is not allowed by the capability", () => {
    const result = adjudicateUncarryableNamespace(["default"], { kind: "Namespace", metadata: { name: "pepr-demo" } });
    expect(result).toBe(`Object carries namespace 'pepr-demo' but namespaces allowed by Capability are '["default"]'.`);
  });
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
  it("should return carriesIgnoredNamespace reason when the object is a namespace that is in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["default"], { kind: "Namespace", metadata: { name: "default" } });
    expect(result).toBe(`Object carries namespace 'default' but ignored namespaces include '["default"]'.`);
  });
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

describe("adjudicateMisboundNamespace", () => {
  const defaultBinding: Binding = {
    event: Event.CREATE,
    filters: {
      annotations: {},
      deletionTimestamp: false,
      labels: {},
      name: "",
      namespaces: [],
      regexName: "^default$",
      regexNamespaces: [],
    },
    kind: {
      group: "v1",
      kind: "Namespace",
    },
    model: kind.Namespace,
  };

  it("should return nothing when binding is correct", () => {
    const result = adjudicateMisboundNamespace(defaultBinding);
    expect(result).toBe(null);
  });

  it("should return reason when binding is incorrect", () => {
    const testBinding = clone(defaultBinding);
    testBinding.filters.namespaces = ["oof"];
    const result = adjudicateMisboundNamespace(testBinding);
    expect(result).toBe(`Cannot use namespace filter on a namespace object.`);
  });
});
