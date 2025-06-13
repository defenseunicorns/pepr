// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, describe } from "vitest";
import { kind, KubernetesObject, modelToGroupVersionKind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import { AdmissionRequestCreatePod, AdmissionRequestDeletePod } from "../../fixtures/loader";
import { filterNoMatchReason, shouldSkipRequest } from "./filter";
import { Binding } from "../types";
import { Event } from "../enums";
import {
  defaultBinding,
  defaultFilters,
  defaultKubernetesObject,
} from "./adjudicators/defaultTestObjects";
import { AdmissionRequest } from "../common-types";

const callback = (): void => undefined;

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
    callback = (): void => {},
    ...rest
  } = overrides;

  return {
    model,
    event,
    kind: bindingKind,
    filters: {
      name,
      namespaces,
      regexNamespaces,
      regexName,
      labels,
      annotations,
      deletionTimestamp,
    },
    callback,
    ...rest,
  };
};

describe("shouldSkipRequest", () => {
  describe("Input Validation", () => {
    it("should handle random inputs without crashing", () => {
      fc.assert(
        fc.property(
          bindingSchema,
          requestSchema,
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

    it("should only skip requests that do not match the binding criteria", () => {
      fc.assert(
        fc.property(
          bindingSchema,
          requestSchema,
          fc.array(fc.string()),
          (binding, req, capabilityNamespaces) => {
            const shouldSkip = shouldSkipRequest(
              binding as Binding,
              req as AdmissionRequest,
              capabilityNamespaces,
            );
            expect(typeof shouldSkip).toBe("string");
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Name Pattern Matching", () => {
    describe("Regex Name Validation", () => {
      describe("Create Operation", () => {
        it("should reject when regex name does not match", () => {
          const binding = createBinding({
            filters: { regexName: "^default$" },
            callback,
          });
          const pod = AdmissionRequestCreatePod();
          expect(shouldSkipRequest(binding, pod, [])).toMatch(
            /Ignoring Admission Callback: Binding defines name regex '\^default\$' but Object carries 'cool-name-podinfo-66bbff7cf4-fwhl2'./,
          );
        });

        it("should not reject when regex name does match", () => {
          const binding = createBinding({
            filters: { regexName: "^cool" },
            callback,
          });
          const pod = AdmissionRequestCreatePod();
          expect(shouldSkipRequest(binding, pod, [])).toBe("");
        });
      });

      describe("Delete Operation", () => {
        it("should reject when regex name does not match", () => {
          const binding = createBinding({
            filters: { regexName: "^default$" },
            callback,
          });
          const pod = AdmissionRequestDeletePod();
          expect(shouldSkipRequest(binding, pod, [])).toMatch(
            /Ignoring Admission Callback: Binding defines name regex '\^default\$' but Object carries 'cool-name-podinfo-66bbff7cf4-fwhl2'./,
          );
        });

        it("should not reject when regex name does match", () => {
          const binding = createBinding({
            filters: { regexName: "^cool" },
            callback,
          });
          const pod = AdmissionRequestDeletePod();
          expect(shouldSkipRequest(binding, pod, [])).toBe("");
        });
      });
    });

    it("should reject when name does not match", () => {
      const binding = createBinding({
        filters: { regexName: "^not-cool", name: "bleh" },
        callback,
      });

      const pod = AdmissionRequestDeletePod();
      expect(shouldSkipRequest(binding, pod, [])).toMatch(
        /Ignoring Admission Callback: Binding defines name 'bleh' but Object carries 'cool-name-podinfo-66bbff7cf4-fwhl2'./,
      );
    });
  });

  describe("Namespace Validation", () => {
    describe("Regex Namespace Validation", () => {
      describe("Create Operation", () => {
        it("should not reject when regex namespace does match", () => {
          const binding = createBinding({
            filters: { regexNamespaces: [new RegExp("^helm").source] },
            callback,
          });

          const pod = AdmissionRequestCreatePod();
          expect(shouldSkipRequest(binding, pod, [])).toBe("");
        });

        it("should reject when regex namespace does not match", () => {
          const binding = createBinding({
            filters: { regexNamespaces: [new RegExp("^argo").source] },
            callback,
          });

          const pod = AdmissionRequestCreatePod();
          expect(shouldSkipRequest(binding, pod, [])).toMatch(
            /Ignoring Admission Callback: Binding defines namespace regexes '\["\^argo"\]' but Object carries 'helm-releasename'./,
          );
        });
      });

      describe("Delete Operation", () => {
        it("should reject when regex namespace does not match", () => {
          const binding = createBinding({
            filters: { regexNamespaces: [new RegExp("^argo").source] },
            callback,
          });

          const pod = AdmissionRequestDeletePod();
          expect(shouldSkipRequest(binding, pod, [])).toMatch(
            /Ignoring Admission Callback: Binding defines namespace regexes '\["\^argo"\]' but Object carries 'helm-releasename'./,
          );
        });

        it("should not reject when regex namespace does match", () => {
          const binding = createBinding({
            filters: { regexNamespaces: [new RegExp("^helm").source] },
            callback,
          });

          const pod = AdmissionRequestDeletePod();
          expect(shouldSkipRequest(binding, pod, [])).toBe("");
        });
      });
    });

    it("should reject when namespace does not match", () => {
      const binding = createBinding({
        filters: { namespaces: ["bleh"] },
        callback,
      });

      const pod = AdmissionRequestCreatePod();
      expect(shouldSkipRequest(binding, pod, [])).toMatch(
        /Ignoring Admission Callback: Binding defines namespaces '\["bleh"\]' but Object carries 'helm-releasename'./,
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

    it("should reject when the capability namespace does not match", () => {
      const binding = createBinding({
        callback,
      });

      const pod = AdmissionRequestCreatePod();

      expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toMatch(
        /Ignoring Admission Callback: Object carries namespace 'helm-releasename' but namespaces allowed by Capability are '\["bleh","bleh2"\]'\./,
      );
    });
  });

  describe("Resource Type Validation", () => {
    it("should reject when kind does not match", () => {
      const binding = createBinding({
        kind: { version: "v1", kind: "Nope", group: "" },
        callback,
      });

      const pod = AdmissionRequestCreatePod();

      expect(shouldSkipRequest(binding, pod, [])).toMatch(
        /Ignoring Admission Callback: Binding defines kind 'Nope' but Request declares 'Pod'./,
      );
    });

    it("should reject when group does not match", () => {
      const binding = createBinding({
        kind: { version: "v1", kind: "Pod", group: "Nope" },
        callback,
      });

      const pod = AdmissionRequestCreatePod();

      expect(shouldSkipRequest(binding, pod, [])).toMatch(
        /Ignoring Admission Callback: Binding defines group 'Nope' but Request declares ''./,
      );
    });

    it("should reject when version does not match", () => {
      const binding = createBinding({
        kind: { version: "Nope", kind: "Pod", group: "" },
        callback,
      });

      const pod = AdmissionRequestCreatePod();

      expect(shouldSkipRequest(binding, pod, [])).toMatch(
        /Ignoring Admission Callback: Binding defines version 'Nope' but Request declares 'v1'./,
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
  });

  describe("Metadata Validation", () => {
    describe("Label Validation", () => {
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
          /Ignoring Admission Callback: Binding defines labels '\{"foo":"bar"\}' but Object carries '\{"app\.kubernetes\.io\/name":"cool-name-podinfo","pod-template-hash":"66bbff7cf4","zarf-agent":"patched","test-op":"create"\}'.*/,
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
    });

    describe("Annotation Validation", () => {
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
          /Ignoring Admission Callback: Binding defines annotations '\{"foo":"bar"\}' but Object carries '\{"prometheus\.io\/port":"9898","prometheus\.io\/scrape":"true"\}'./,
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
    });
  });

  describe("Deletion Handling", () => {
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
});

describe("filterNoMatchReason", () => {
  it.each([
    {},
    { metadata: { namespace: "pepr-uds" } },
    { metadata: { namespace: "pepr-core" } },
    { metadata: { namespace: "uds-ns" } },
    { metadata: { namespace: "uds" } },
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
    it.each([
      "pepr-system",
      "pepr-uds-system",
      "uds-system",
      "some-thing-that-is-a-system",
      "your-system",
    ])("should not return an error message (namespace: '%s')", namespace => {
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
      const kubernetesObject: KubernetesObject = {
        ...defaultKubernetesObject,
        metadata: { namespace: namespace },
      };
      const capabilityNamespaces: string[] = [];
      const result = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces);
      expect(result).toEqual("");
    });
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
      const result = filterNoMatchReason(
        binding,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
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
      const result = filterNoMatchReason(
        binding,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      "Ignoring Watch Callback: Binding defines namespaces '[\"ns1\"]' but Object carries ''.",
    );
  });

  it("returns namespace filter error for namespace objects with namespace filters", () => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: "Namespace", group: "some-group" },
      filters: { ...defaultFilters, namespaces: ["ns1"] },
    };
    const obj = {};
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      "Ignoring Watch Callback: Cannot use namespace filter on a namespace object.",
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines name 'pepr' but Object carries 'not-pepr'.`,
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      "Ignoring Watch Callback: Binding defines deletionTimestamp but Object does not carry it.",
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).not.toEqual(
      "Ignoring Watch Callback: Binding defines deletionTimestamp Object does not carry it.",
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines namespaces '["ns1"]' but Object carries 'ns2'.`,
    );
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
      const result = filterNoMatchReason(
        binding,
        kubernetesObject,
        capabilityNamespaces,
        ignoredNamespaces,
      );
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
    const result = filterNoMatchReason(
      binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual("");
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
