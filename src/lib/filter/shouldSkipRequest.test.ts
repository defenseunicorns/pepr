// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { kind } from "kubernetes-fluent-client";
import * as fc from "fast-check";
import {
  AdmissionRequestCreateClusterRole,
  AdmissionRequestCreateDeployment,
  AdmissionRequestCreatePod,
  AdmissionRequestDeletePod,
} from "../../fixtures/loader";
import { shouldSkipRequest } from "./filter";
import { AdmissionRequest, Binding, Filters } from "../types";
import { Event } from "../enums";
import { defaultFilters } from "./adjudicators/defaultTestObjects";
import { clusterScopedBinding, groupBinding, podKind } from "../helpers.test";

const defaultBinding: Binding = {
  event: Event.ANY,
  filters: defaultFilters,
  kind: podKind,
  model: kind.Pod,
};

describe("when fuzzing shouldSkipRequest", () => {
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

describe("when checking specific properties of shouldSkipRequest()", () => {});

describe("when a binding contains a group scoped object", () => {
  const admissionRequestDeployment = AdmissionRequestCreateDeployment();
  const admissionRequestPod = AdmissionRequestCreatePod();
  it("should skip request when the group is different", () => {
    expect(shouldSkipRequest(groupBinding, admissionRequestPod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines group '.+' but Request declares ''./,
    );
  });
  it("should not skip request when the group is the same", () => {
    const groupBindingNoRegex: Binding = {
      ...groupBinding,
      filters: {
        ...groupBinding.filters,
        regexName: "",
      },
    };
    expect(shouldSkipRequest(groupBindingNoRegex, admissionRequestDeployment, [])).toMatch("");
  });
});

describe("when a capability defines namespaces and the admission request object is cluster-scoped", () => {
  const capabilityNamespaces = ["monitoring"];
  const admissionRequestCreateClusterRole = AdmissionRequestCreateClusterRole();
  it("should skip request when the capability namespace does not exist on the object", () => {
    const binding: Binding = {
      ...clusterScopedBinding,
      event: Event.CREATE,
      filters: {
        ...clusterScopedBinding.filters,
        regexName: "",
      },
    };

    expect(shouldSkipRequest(binding, admissionRequestCreateClusterRole, capabilityNamespaces)).toMatch(
      /Ignoring Admission Callback: Object does not carry a namespace but namespaces allowed by Capability are '.+'./,
    );
  });
});
describe("when a binding contains a cluster scoped object", () => {
  const admissionRequestCreateClusterRole = AdmissionRequestCreateClusterRole();

  it("should skip request when the binding defines a namespace on a cluster scoped object", () => {
    const clusterScopedBindingWithNamespace: Binding = {
      ...clusterScopedBinding,
      event: Event.CREATE,
      filters: {
        ...clusterScopedBinding.filters,
        namespaces: ["namespace"],
      },
    };
    expect(shouldSkipRequest(clusterScopedBindingWithNamespace, admissionRequestCreateClusterRole, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespaces '.+' but Object carries ''./,
    );
  });
});

describe("when a pod is created", () => {
  it("should reject when regex name does not match", () => {
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(defaultBinding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name regex '.+' but Object carries '.+'./,
    );
  });

  it("should not reject when regex name does match", () => {
    const filters: Filters = { ...defaultFilters, regexName: "^cool" };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should not reject when regex namespace does match", () => {
    const filters: Filters = {
      ...defaultFilters,
      regexNamespaces: [new RegExp("^helm").source],
      regexName: "",
    };

    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should reject when regex namespace does not match", () => {
    const filters: Filters = { ...defaultFilters, regexNamespaces: [new RegExp("^argo").source] };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespace regexes '.+' but Object carries '.+'./,
    );
  });
  it("should not reject when namespace is not ignored", () => {
    const filters: Filters = { ...defaultFilters, regexName: "" };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch("");
  });
  it("should reject when namespace is ignored", () => {
    const filters: Filters = { ...defaultFilters, regexName: "" };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [], ["helm-releasename"])).toMatch(
      /Ignoring Admission Callback: Object carries namespace '.+' but ignored namespaces include '.+'./,
    );
  });
});

describe("when a pod is deleted", () => {
  it("should reject when regex name does not match", () => {
    const filters: Filters = { ...defaultFilters, regexName: "^default$" };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name regex '.+' but Object carries '.+'./,
    );
  });

  it("should not reject when regex name does match", () => {
    const filters: Filters = { ...defaultFilters, regexName: "^cool" };
    const binding: Binding = { ...defaultBinding, filters };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should reject when regex namespace does not match", () => {
    const filters: Filters = { ...defaultFilters, regexNamespaces: [new RegExp("eargo").source] };
    const binding: Binding = {
      ...defaultBinding,
      filters,
    };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines namespace regexes '.+' but Object carries '.+'./,
    );
  });

  it("should not reject when regex namespace does match", () => {
    const filters: Filters = {
      ...defaultFilters,
      regexNamespaces: [new RegExp("^helm").source],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    };
    const binding: Binding = {
      ...defaultBinding,
      filters,
    };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toBe("");
  });

  it("should reject when name does not match", () => {
    const filters: Filters = { ...defaultFilters, name: "bleh", regexName: "^not-cool" };
    const binding: Binding = {
      ...defaultBinding,
      filters,
    };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name '.+' but Object carries '.+'./,
    );
  });

  it("should reject when namespace is ignored", () => {
    const filters: Filters = { ...defaultFilters, regexName: "", namespaces: [] };
    const binding: Binding = {
      ...defaultBinding,
      filters,
    };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [], ["helm-releasename"])).toMatch(
      /Ignoring Admission Callback: Object carries namespace '.+' but ignored namespaces include '.+'./,
    );
  });

  it("should not reject when namespace is not ignored", () => {
    const filters: Filters = { ...defaultFilters, regexName: "" };
    const binding: Binding = {
      ...defaultBinding,
      filters,
    };
    const pod = AdmissionRequestDeletePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch("");
  });
});

it("should reject when kind does not match", () => {
  const filters: Filters = { ...defaultFilters, regexName: "" };
  const binding: Binding = {
    ...defaultBinding,
    kind: {
      group: "",
      version: "v1",
      kind: "Nope",
    },
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines kind '.+' but Request declares 'Pod'./,
  );
});

it("should reject when group does not match", () => {
  const filters: Filters = { ...defaultFilters, regexName: "" };
  const binding: Binding = {
    ...defaultBinding,
    kind: {
      group: "Nope",
      version: "v1",
      kind: "Pod",
    },
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines group '.+' but Request declares ''./,
  );
});

it("should reject when version does not match", () => {
  const filters: Filters = { ...defaultFilters, regexName: "" };
  const binding: Binding = {
    ...defaultBinding,
    kind: {
      group: "",
      version: "Nope",
      kind: "Pod",
    },
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines version '.+' but Request declares '.+'./,
  );
});

it("should allow when group, version, and kind match", () => {
  const filters: Filters = { ...defaultFilters, regexName: "" };
  const binding: Binding = { ...defaultBinding, filters };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

it("should allow when kind match and others are empty", () => {
  const filters: Filters = { ...defaultFilters, regexName: "" };

  const binding: Binding = { ...defaultBinding, filters };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

it("should reject when the capability namespace does not match", () => {
  const filters: Filters = { ...defaultFilters };
  const binding: Binding = {
    ...defaultBinding,
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, ["bleh", "bleh2"])).toMatch(
    /Ignoring Admission Callback: Object carries namespace '.+' but namespaces allowed by Capability are '.+'./,
  );
});

it("should reject when namespace does not match", () => {
  const filters: Filters = { ...defaultFilters, namespaces: ["bleh"] };
  const binding: Binding = { ...defaultBinding, filters };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines namespaces '.+' but Object carries '.+'./,
  );
});

it("should allow when namespace is match", () => {
  const filters: Filters = {
    ...defaultFilters,
    namespaces: ["helm-releasename", "unicorn", "things"],
    labels: {},
    annotations: {},
    deletionTimestamp: false,
    regexNamespaces: [],
    regexName: "",
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

it("should reject when label does not match", () => {
  const filters: Filters = {
    ...defaultFilters,
    labels: {
      foo: "bar",
    },
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines labels '.+' but Object carries '.+'./,
  );
});

it("should allow when label is match", () => {
  const filters: Filters = {
    ...defaultFilters,
    regexName: "",
    labels: {
      foo: "bar",
      test: "test1",
    },
    annotations: {},
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
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
  const filters: Filters = {
    ...defaultFilters,
    annotations: {
      foo: "bar",
    },
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
  };
  const pod = AdmissionRequestCreatePod();

  expect(shouldSkipRequest(binding, pod, [])).toMatch(
    /Ignoring Admission Callback: Binding defines annotations '.+' but Object carries '.+'./,
  );
});

it("should allow when annotation is match", () => {
  const filters: Filters = {
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
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
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
  const filters: Filters = {
    ...defaultFilters,
    regexNamespaces: [],
    regexName: "",
    deletionTimestamp: false,
    labels: {
      "test-op": "delete",
    },
    annotations: {},
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
  };

  const pod = AdmissionRequestDeletePod();

  expect(shouldSkipRequest(binding, pod, [])).toBe("");
});

it("should allow when deletionTimestamp is present on pod", () => {
  const filters: Filters = {
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
  };
  const binding: Binding = {
    ...defaultBinding,
    filters,
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
  const filters: Filters = {
    ...defaultFilters,
    regexName: "",
    annotations: {
      foo: "bar",
      test: "test1",
    },
    deletionTimestamp: true,
  };
  const binding: Binding = { ...defaultBinding, filters };

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

describe("when multiple filters are triggered", () => {
  const filters: Filters = {
    ...defaultFilters,
    regexName: "asdf",
    name: "not-a-match",
    namespaces: ["not-allowed", "also-not-matching"],
  };
  const binding: Binding = { ...defaultBinding, filters };
  it("should display the failure message for the first matching filter", () => {
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).toMatch(
      /Ignoring Admission Callback: Binding defines name 'not-a-match' but Object carries '.+'./,
    );
  });
  it("should NOT display the failure message for the second matching filter", () => {
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).not.toMatch(
      /Ignoring Admission Callback: Binding defines namespaces 'not-allowed,also-not-matching' but Object carries '.+'./,
    );
  });
  it("should NOT display the failure message for the third matching filter", () => {
    const pod = AdmissionRequestCreatePod();
    expect(shouldSkipRequest(binding, pod, [])).not.toMatch(
      /Ignoring Admission Callback: Binding defines name regex 'asdf' but Object carries '.*./,
    );
  });
});
