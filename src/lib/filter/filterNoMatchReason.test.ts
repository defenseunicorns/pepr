// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, test } from "@jest/globals";
import { KubernetesObject, kind } from "kubernetes-fluent-client";
import { filterNoMatchReason } from "./filterNoMatchReason";
import { Binding } from "../types";
import { Event } from "../enums";

export const callback = () => undefined;

describe("filterNoMatchReason", () => {
  test("returns regex namespace filter error for Pods whos namespace does not match the regex", () => {
    const binding = {
      kind: { kind: "Pod" },
      filters: { regexNamespaces: ["(.*)-system"], namespaces: [] },
    };
    const obj = { metadata: { namespace: "pepr-demo" } };
    const objArray = [
      { ...obj },
      { ...obj, metadata: { namespace: "pepr-uds" } },
      { ...obj, metadata: { namespace: "pepr-core" } },
      { ...obj, metadata: { namespace: "uds-ns" } },
      { ...obj, metadata: { namespace: "uds" } },
    ];
    const capabilityNamespaces: string[] = [];
    objArray.map(object => {
      const result = filterNoMatchReason(
        binding as unknown as Partial<Binding>,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
      expect(result).toEqual(
        `Ignoring Watch Callback: Binding defines namespace regexes '["(.*)-system"]' but Object carries '${object?.metadata?.namespace}'.`,
      );
    });
  });

  test("returns no regex namespace filter error for Pods whos namespace does match the regex", () => {
    const binding = {
      kind: { kind: "Pod" },
      filters: { regexNamespaces: [/(.*)-system/], namespaces: [] },
    };
    const obj = { metadata: { namespace: "pepr-demo" } };
    const objArray = [
      { ...obj, metadata: { namespace: "pepr-system" } },
      { ...obj, metadata: { namespace: "pepr-uds-system" } },
      { ...obj, metadata: { namespace: "uds-system" } },
      { ...obj, metadata: { namespace: "some-thing-that-is-a-system" } },
      { ...obj, metadata: { namespace: "your-system" } },
    ];
    const capabilityNamespaces: string[] = [];
    objArray.map(object => {
      const result = filterNoMatchReason(
        binding as unknown as Partial<Binding>,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
      expect(result).toEqual(``);
    });
  });

  // Names Fail
  test("returns regex name filter error for Pods whos name does not match the regex", () => {
    const binding = {
      kind: { kind: "Pod" },
      filters: { regexName: "^system", namespaces: [] },
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
        binding as unknown as Partial<Binding>,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
      expect(result).toEqual(
        `Ignoring Watch Callback: Binding defines name regex '^system' but Object carries '${object?.metadata?.name}'.`,
      );
    });
  });

  // Names Pass
  test("returns no regex name filter error for Pods whos name does match the regex", () => {
    const binding = {
      kind: { kind: "Pod" },
      filters: { regexName: /^system/, namespaces: [] },
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
        binding as unknown as Partial<Binding>,
        object as unknown as Partial<KubernetesObject>,
        capabilityNamespaces,
      );
      expect(result).toEqual(``);
    });
  });

  test("returns namespace filter error for namespace objects with namespace filters", () => {
    const binding = {
      kind: { kind: "Namespace" },
      filters: { namespaces: ["ns1"] },
    };
    const obj = {};
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual("Ignoring Watch Callback: Cannot use namespace filter on a namespace object.");
  });

  test("return an Ignoring Watch Callback string if the binding name and object name are different", () => {
    const binding = {
      filters: { name: "pepr" },
    };
    const obj = {
      metadata: {
        name: "not-pepr",
      },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(`Ignoring Watch Callback: Binding defines name 'pepr' but Object carries 'not-pepr'.`);
  });
  test("returns no Ignoring Watch Callback string if the binding name and object name are the same", () => {
    const binding = {
      filters: { name: "pepr" },
    };
    const obj = {
      metadata: { name: "pepr" },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual("");
  });

  test("return deletionTimestamp error when there is no deletionTimestamp in the object", () => {
    const binding = {
      filters: { deletionTimestamp: true },
    };
    const obj = {
      metadata: {},
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp but Object does not carry it.");
  });

  test("return no deletionTimestamp error when there is a deletionTimestamp in the object", () => {
    const binding = {
      filters: { deletionTimestamp: true },
    };
    const obj = {
      metadata: {
        deletionTimestamp: "2021-01-01T00:00:00Z",
      },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).not.toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp Object does not carry it.");
  });

  test("returns label overlap error when there is no overlap between binding and object labels", () => {
    const binding = {
      filters: { labels: { key: "value" } },
    };
    const obj = {
      metadata: { labels: { anotherKey: "anotherValue" } },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines labels '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
    );
  });

  test("returns annotation overlap error when there is no overlap between binding and object annotations", () => {
    const binding = {
      filters: { annotations: { key: "value" } },
    };
    const obj = {
      metadata: { annotations: { anotherKey: "anotherValue" } },
    };
    const capabilityNamespaces: string[] = [];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines annotations '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
    );
  });

  test("returns capability namespace error when object is not in capability namespaces", () => {
    const binding = {
      model: kind.Pod,
      event: Event.Any,
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
      callback,
    };

    const obj = {
      metadata: { namespace: "ns2", name: "bleh" },
    };
    const capabilityNamespaces = ["ns1"];
    const result = filterNoMatchReason(
      binding as Binding,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Object carries namespace 'ns2' but namespaces allowed by Capability are '["ns1"]'.`,
    );
  });

  test("returns binding namespace error when filter namespace is not part of capability namespaces", () => {
    const binding = {
      filters: { namespaces: ["ns3"], regexNamespaces: [] },
    };
    const obj = {};
    const capabilityNamespaces = ["ns1", "ns2"];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines namespaces ["ns3"] but namespaces allowed by Capability are '["ns1","ns2"]'.`,
    );
  });

  test("returns binding and object namespace error when they do not overlap", () => {
    const binding = {
      filters: { namespaces: ["ns1"], regexNamespaces: [] },
    };
    const obj = {
      metadata: { namespace: "ns2" },
    };
    const capabilityNamespaces = ["ns1", "ns2"];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual(`Ignoring Watch Callback: Binding defines namespaces '["ns1"]' but Object carries 'ns2'.`);
  });

  test("return watch violation message when object is in an ignored namespace", () => {
    const binding = {
      filters: { namespaces: ["ns3"] },
    };
    const obj = {
      metadata: { namespace: "ns3" },
    };
    const capabilityNamespaces = ["ns3"];
    const ignoredNamespaces = ["ns3"];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
      ignoredNamespaces,
    );
    expect(result).toEqual(
      `Ignoring Watch Callback: Object carries namespace 'ns3' but ignored namespaces include '["ns3"]'.`,
    );
  });

  test("returns empty string when all checks pass", () => {
    const binding = {
      filters: { namespaces: ["ns1"], labels: { key: "value" }, annotations: { key: "value" } },
    };
    const obj = {
      metadata: { namespace: "ns1", labels: { key: "value" }, annotations: { key: "value" } },
    };
    const capabilityNamespaces = ["ns1"];
    const result = filterNoMatchReason(
      binding as unknown as Partial<Binding>,
      obj as unknown as Partial<KubernetesObject>,
      capabilityNamespaces,
    );
    expect(result).toEqual("");
  });
});

// // SPDX-License-Identifier: Apache-2.0
// // SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// import { expect, describe, it } from "@jest/globals";
// import { kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
// import * as fc from "fast-check";
// import { CreatePod, DeletePod } from "../../fixtures/loader";
// import { shouldSkipRequest } from "./shouldSkipRequest";
// import { AdmissionRequest, Binding } from "../types";
// import { Event } from "../enums";

// export const callback = () => undefined;

// export const podKind = modelToGroupVersionKind(kind.Pod.name);

// const defaultFilters = {
//   annotations: {},
//   deletionTimestamp: false,
//   labels: {},
//   name: "",
//   namespaces: [],
//   regexName: "^default$",
//   regexNamespaces: [],
// };
// const defaultBinding = {
//   callback,
//   event: Event.Any,
//   filters: defaultFilters,
//   kind: podKind,
//   model: kind.Pod,
// };

// describe("when fuzzing shouldSkipRequest", () => {
//   it("should handle random inputs without crashing", () => {
//     fc.assert(
//       fc.property(
//         fc.record({
//           event: fc.constantFrom("CREATE", "UPDATE", "DELETE", "ANY"),
//           kind: fc.record({
//             group: fc.string(),
//             version: fc.string(),
//             kind: fc.string(),
//           }),
//           filters: fc.record({
//             name: fc.string(),
//             namespaces: fc.array(fc.string()),
//             labels: fc.dictionary(fc.string(), fc.string()),
//             annotations: fc.dictionary(fc.string(), fc.string()),
//             deletionTimestamp: fc.boolean(),
//           }),
//         }),
//         fc.record({
//           operation: fc.string(),
//           uid: fc.string(),
//           name: fc.string(),
//           namespace: fc.string(),
//           kind: fc.record({
//             group: fc.string(),
//             version: fc.string(),
//             kind: fc.string(),
//           }),
//           object: fc.record({
//             metadata: fc.record({
//               deletionTimestamp: fc.option(fc.date()),
//             }),
//           }),
//         }),
//         fc.array(fc.string()),
//         (binding, req, capabilityNamespaces) => {
//           expect(() =>
//             shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces),
//           ).not.toThrow();
//         },
//       ),
//       { numRuns: 100 },
//     );
//   });

//   it("should only skip requests that do not match the binding criteria", () => {
//     fc.assert(
//       fc.property(
//         fc.record({
//           event: fc.constantFrom("CREATE", "UPDATE", "DELETE", "ANY"),
//           kind: fc.record({
//             group: fc.string(),
//             version: fc.string(),
//             kind: fc.string(),
//           }),
//           filters: fc.record({
//             name: fc.string(),
//             namespaces: fc.array(fc.string()),
//             labels: fc.dictionary(fc.string(), fc.string()),
//             annotations: fc.dictionary(fc.string(), fc.string()),
//             deletionTimestamp: fc.boolean(),
//           }),
//         }),
//         fc.record({
//           operation: fc.string(),
//           uid: fc.string(),
//           name: fc.string(),
//           namespace: fc.string(),
//           kind: fc.record({
//             group: fc.string(),
//             version: fc.string(),
//             kind: fc.string(),
//           }),
//           object: fc.record({
//             metadata: fc.record({
//               deletionTimestamp: fc.option(fc.date()),
//             }),
//           }),
//         }),
//         fc.array(fc.string()),
//         (binding, req, capabilityNamespaces) => {
//           const shouldSkip = shouldSkipRequest(binding as Binding, req as AdmissionRequest, capabilityNamespaces);
//           expect(typeof shouldSkip).toBe("string");
//         },
//       ),
//       { numRuns: 100 },
//     );
//   });
// });

// describe("when checking specific properties of shouldSkipRequest()", () => {});

// describe("when a pod is created", () => {
//   it("should reject when regex name does not match", () => {
//     const pod = CreatePod();
//     expect(shouldSkipRequest(defaultBinding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines name regex '.+' but Object carries '.+'./,
//     );
//   });

//   it("should not reject when regex name does match", () => {
//     const filters = { ...defaultFilters, regexName: "^cool" };
//     const binding = { ...defaultBinding, filters };
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).toBe("");
//   });

//   it("should not reject when regex namespace does match", () => {
//     const filters = {
//       ...defaultFilters,
//       regexNamespaces: ["^helm"],
//       regexName: "",
//     };

//     const binding = { ...defaultBinding, filters };
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).toBe("");
//   });

//   it("should reject when regex namespace does not match", () => {
//     const filters = { ...defaultFilters, regexNamespaces: ["^argo"] };
//     const binding = { ...defaultBinding, filters };
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines namespace regexes '.+' but Object carries '.+'./,
//     );
//   });
//   it("should not reject when namespace is not ignored", () => {
//     const filters = { ...defaultFilters, regexName: "" };
//     const binding = { ...defaultBinding, filters };
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch("");
//   });
//   it("should reject when namespace is ignored", () => {
//     const filters = { ...defaultFilters, regexName: "" };
//     const binding = { ...defaultBinding, filters };
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [], ["helm-releasename"])).toMatch(
//       /Ignoring Admission Callback: Object carries namespace '.+' but ignored namespaces include '.+'./,
//     );
//   });
// });

// describe("when a pod is deleted", () => {
//   it("should reject when regex name does not match", () => {
//     const filters = { ...defaultFilters, regexName: "^default$" };
//     const binding = { ...defaultBinding, filters };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines name regex '.+' but Object carries '.+'./,
//     );
//   });

//   it("should not reject when regex name does match", () => {
//     const filters = { ...defaultFilters, regexName: "^cool" };
//     const binding = { ...defaultBinding, filters };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toBe("");
//   });

//   it("should reject when regex namespace does not match", () => {
//     const filters = { ...defaultFilters, regexNamespaces: ["^argo"] };
//     const binding = {
//       ...defaultBinding,
//       filters,
//     };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines namespace regexes '.+' but Object carries '.+'./,
//     );
//   });

//   it("should not reject when regex namespace does match", () => {
//     const filters = {
//       ...defaultFilters,
//       regexNamespaces: ["^helm"],
//       regexName: "",
//       labels: {},
//       annotations: {},
//       deletionTimestamp: false,
//     };
//     const binding = {
//       ...defaultBinding,
//       filters,
//     };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toBe("");
//   });

//   it("should reject when name does not match", () => {
//     const filters = { ...defaultFilters, name: "bleh", regexName: "^not-cool" };
//     const binding = {
//       ...defaultBinding,
//       filters,
//     };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines name '.+' but Object carries '.+'./,
//     );
//   });

//   it("should reject when namespace is ignored", () => {
//     const filters = { ...defaultFilters, regexName: "", namespaces: [] };
//     const binding = {
//       ...defaultBinding,
//       filters,
//     };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [], ["helm-releasename"])).toMatch(
//       /Ignoring Admission Callback: Object carries namespace '.+' but ignored namespaces include '.+'./,
//     );
//   });

//   it("should not reject when namespace is not ignored", () => {
//     const filters = { ...defaultFilters, regexName: "" };
//     const binding = {
//       ...defaultBinding,
//       filters,
//       callback,
//     };
//     const pod = DeletePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch("");
//   });
// });

// it("should reject when kind does not match", () => {
//   const filters = { ...defaultFilters, regexName: "" };
//   const binding = {
//     ...defaultBinding,
//     kind: {
//       group: "",
//       version: "v1",
//       kind: "Nope",
//     },
//     filters,
//     callback,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines kind '.+' but Request declares 'not set'./,
//   );
// });

// it("should reject when group does not match", () => {
//   const filters = { ...defaultFilters, regexName: "" };
//   const binding = {
//     ...defaultBinding,
//     kind: {
//       group: "Nope",
//       version: "v1",
//       kind: "Pod",
//     },
//     filters,
//     callback,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines group '.+' but Request declares '.+'./,
//   );
// });

// it("should reject when version does not match", () => {
//   const filters = { ...defaultFilters, regexName: "" };
//   const binding = {
//     ...defaultBinding,
//     kind: {
//       group: "",
//       version: "Nope",
//       kind: "Pod",
//     },
//     filters,
//     callback,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines version '.+' but Request declares '.+'./,
//   );
// });

// it("should allow when group, version, and kind match", () => {
//   const filters = { ...defaultFilters, regexName: "" };
//   const binding = { ...defaultBinding, filters };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should allow when kind match and others are empty", () => {
//   const filters = { ...defaultFilters, regexName: "" };

//   const binding = { ...defaultBinding, filters };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should reject when the capability namespace does not match", () => {
//   const filters = { ...defaultFilters };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toMatch(
//     /Ignoring Admission Callback: Object carries namespace '.+' but namespaces allowed by Capability are '.+'./,
//   );
// });

// it("should reject when namespace does not match", () => {
//   const filters = { ...defaultFilters, namespaces: ["bleh"] };
//   const binding = { ...defaultBinding, filters };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines namespaces '.+' but Object carries '.+'./,
//   );
// });

// it("should allow when namespace is match", () => {
//   const filters = {
//     ...defaultFilters,
//     namespaces: ["helm-releasename", "unicorn", "things"],
//     labels: {},
//     annotations: {},
//     deletionTimestamp: false,
//     regexNamespaces: [],
//     regexName: "",
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should reject when label does not match", () => {
//   const filters = {
//     ...defaultFilters,
//     labels: {
//       foo: "bar",
//     },
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines labels '.+' but Object carries '.+'./,
//   );
// });

// it("should allow when label is match", () => {
//   const filters = {
//     ...defaultFilters,
//     regexName: "",
//     labels: {
//       foo: "bar",
//       test: "test1",
//     },
//     annotations: {},
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };

//   const pod = CreatePod();
//   pod.object.metadata = pod.object.metadata || {};
//   pod.object.metadata.labels = {
//     foo: "bar",
//     test: "test1",
//     test2: "test2",
//   };

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should reject when annotation does not match", () => {
//   const filters = {
//     ...defaultFilters,
//     annotations: {
//       foo: "bar",
//     },
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };
//   const pod = CreatePod();

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines annotations '.+' but Object carries '.+'./,
//   );
// });

// it("should allow when annotation is match", () => {
//   const filters = {
//     name: "",
//     namespaces: [],
//     labels: {},
//     annotations: {
//       foo: "bar",
//       test: "test1",
//     },
//     deletionTimestamp: false,
//     regexNamespaces: [],
//     regexName: "",
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };

//   const pod = CreatePod();
//   pod.object.metadata = pod.object.metadata || {};
//   pod.object.metadata.annotations = {
//     foo: "bar",
//     test: "test1",
//     test2: "test2",
//   };

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should use `oldObject` when the operation is `DELETE`", () => {
//   const filters = {
//     ...defaultFilters,
//     regexNamespaces: [],
//     regexName: "",
//     deletionTimestamp: false,
//     labels: {
//       "test-op": "delete",
//     },
//     annotations: {},
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };

//   const pod = DeletePod();

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should allow when deletionTimestamp is present on pod", () => {
//   const filters = {
//     name: "",
//     namespaces: [],
//     labels: {},
//     regexNamespaces: [],
//     regexName: "",
//     annotations: {
//       foo: "bar",
//       test: "test1",
//     },
//     deletionTimestamp: true,
//   };
//   const binding = {
//     ...defaultBinding,
//     filters,
//   };

//   const pod = CreatePod();
//   pod.object.metadata = pod.object.metadata || {};
//   pod.object.metadata!.deletionTimestamp = new Date("2021-09-01T00:00:00Z");
//   pod.object.metadata.annotations = {
//     foo: "bar",
//     test: "test1",
//     test2: "test2",
//   };

//   expect(shouldSkipRequest(binding, pod, [])).toBe("");
// });

// it("should reject when deletionTimestamp is not present on pod", () => {
//   const filters = {
//     ...defaultFilters,
//     regexName: "",
//     annotations: {
//       foo: "bar",
//       test: "test1",
//     },
//     deletionTimestamp: true,
//   };
//   const binding = { ...defaultBinding, filters };

//   const pod = CreatePod();
//   pod.object.metadata = pod.object.metadata || {};
//   pod.object.metadata.annotations = {
//     foo: "bar",
//     test: "test1",
//     test2: "test2",
//   };

//   expect(shouldSkipRequest(binding, pod, [])).toMatch(
//     /Ignoring Admission Callback: Binding defines deletionTimestamp but Object does not carry it./,
//   );
// });

// describe("when multiple filters are triggered", () => {
//   const filters = {
//     ...defaultFilters,
//     regexName: "asdf",
//     name: "not-a-match",
//     namespaces: ["not-allowed", "also-not-matching"],
//   };
//   const binding = { ...defaultBinding, filters };
//   it("should display the failure message for the first matching filter", () => {
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).toMatch(
//       /Ignoring Admission Callback: Binding defines name 'not-a-match' but Object carries '.+'./,
//     );
//   });
//   it("should NOT display the failure message for the second matching filter", () => {
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).not.toMatch(
//       /Ignoring Admission Callback: Binding defines namespaces 'not-allowed,also-not-matching' but Object carries '.+'./,
//     );
//   });
//   it("should NOT display the failure message for the third matching filter", () => {
//     const pod = CreatePod();
//     expect(shouldSkipRequest(binding, pod, [])).not.toMatch(
//       /Ignoring Admission Callback: Binding defines name regex 'asdf' but Object carries '.*./,
//     );
//   });
// });
