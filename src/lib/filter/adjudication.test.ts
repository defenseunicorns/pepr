import { describe, it, expect } from "@jest/globals";
import { kind } from "kubernetes-fluent-client";
import { clone } from "ramda";
import { Binding } from "../types";
import { defaultAdmissionRequest, defaultBinding } from "./adjudicators/defaultTestObjects";
import {
  adjudicateMisboundDeleteWithDeletionTimestamp,
  adjudicateMismatchedDeletionTimestamp,
  adjudicateMismatchedEvent,
  adjudicateMismatchedName,
  adjudicateMismatchedGroup,
  adjudicateMismatchedVersion,
  adjudicateMismatchedKind,
  adjudicateUnbindableNamespaces,
  adjudicateUncarryableNamespace,
  adjudicateMismatchedNamespace,
  adjudicateMismatchedLabels,
  adjudicateMismatchedAnnotations,
  adjudicateMismatchedNameRegex,
  adjudicateCarriesIgnoredNamespace,
  adjudicateMissingCarriableNamespace,
  adjudicateMismatchedNamespaceRegex,
  adjudicateMisboundNamespace,
} from "./adjudication";
import { clusterScopedBinding } from "./filter.test";
import { Event, Operation } from "../enums";

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
    expect(result).toBe(
      `Binding defines group 'rbac.authorization.k8s.io' but Request declares 'other-group'.`,
    );
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
    const result = adjudicateUncarryableNamespace(["default"], {
      kind: "Namespace",
      metadata: { name: "pepr-demo" },
    });
    expect(result).toBe(
      `Object carries namespace 'pepr-demo' but namespaces allowed by Capability are '["default"]'.`,
    );
  });
  it("should return uncarryableNamespace reason when the object carries a namespace that is not allowed by the capability", () => {
    const result = adjudicateUncarryableNamespace(["default"], {
      metadata: { namespace: "kube-system" },
    });
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
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, namespaces: ["kube-system"] },
      },
      { metadata: { namespace: "default" } },
    );
    expect(result).toBe(
      `Binding defines namespaces '["kube-system"]' but Object carries 'default'.`,
    );
  });
  it("should not return mismatchedNamespace reason when the binding namespace and object namespace match", () => {
    const result = adjudicateMismatchedNamespace(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, namespaces: ["default"] },
      },
      { metadata: { namespace: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedLabels", () => {
  it("should return mismatchedLabels reason when the binding labels do not match the object labels", () => {
    const result = adjudicateMismatchedLabels(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, labels: { foo: "bar" } },
      },
      { metadata: { labels: { foo: "not-bar" } } },
    );
    expect(result).toBe(
      `Binding defines labels '{"foo":"bar"}' but Object carries '{"foo":"not-bar"}'.`,
    );
  });
  it("should not return mismatchedLabels reason when the binding labels and object labels match", () => {
    const result = adjudicateMismatchedLabels(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, labels: { foo: "bar" } },
      },
      { metadata: { labels: { foo: "bar" } } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedAnnotations", () => {
  it("should return mismatchedAnnotations reason when the binding annotations do not match the object annotations", () => {
    const result = adjudicateMismatchedAnnotations(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, annotations: { foo: "bar" } },
      },
      { metadata: { annotations: { foo: "not-bar" } } },
    );
    expect(result).toBe(
      `Binding defines annotations '{"foo":"bar"}' but Object carries '{"foo":"not-bar"}'.`,
    );
  });
  it("should not return mismatchedAnnotations reason when the binding annotations and object annotations match", () => {
    const result = adjudicateMismatchedAnnotations(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, annotations: { foo: "bar" } },
      },
      { metadata: { annotations: { foo: "bar" } } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNameRegex", () => {
  it("should return mismatchedNameRegex reason when the binding regexName does not match the object name", () => {
    const result = adjudicateMismatchedNameRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexName: "^default$" },
      },
      { metadata: { name: "not-default" } },
    );
    expect(result).toBe(`Binding defines name regex '^default$' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedNameRegex reason when the binding regexName and object name match", () => {
    const result = adjudicateMismatchedNameRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexName: "^default$" },
      },
      { metadata: { name: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNameRegex", () => {
  it("should return mismatchedNameRegex reason when the binding regexName does not match the object name", () => {
    const result = adjudicateMismatchedNameRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexName: "^default$" },
      },
      { metadata: { name: "not-default" } },
    );
    expect(result).toBe(`Binding defines name regex '^default$' but Object carries 'not-default'.`);
  });
  it("should not return mismatchedNameRegex reason when the binding regexName and object name match", () => {
    const result = adjudicateMismatchedNameRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexName: "^default$" },
      },
      { metadata: { name: "default" } },
    );
    expect(result).toBe(null);
  });
});

describe("adjudicateCarriesIgnoredNamespace", () => {
  it("should return carriesIgnoredNamespace reason when the object is a namespace that is in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["default"], {
      kind: "Namespace",
      metadata: { name: "default" },
    });
    expect(result).toBe(
      `Object carries namespace 'default' but ignored namespaces include '["default"]'.`,
    );
  });
  it("should return carriesIgnoredNamespace reason when the object carries a namespace that is in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["default"], {
      metadata: { namespace: "default" },
    });
    expect(result).toBe(
      `Object carries namespace 'default' but ignored namespaces include '["default"]'.`,
    );
  });
  it("should not return carriesIgnoredNamespace reason when the object carries a namespace that is not in the ignoredNamespaces", () => {
    const result = adjudicateCarriesIgnoredNamespace(["kube-system"], {
      metadata: { namespace: "default" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMissingCarriableNamespace", () => {
  it("should return missingCarriableNamespace reason when the object does not carry a namespace and the capability does not allow it", () => {
    const result = adjudicateMissingCarriableNamespace(["default"], { metadata: {} });
    expect(result).toBe(
      `Object does not carry a namespace but namespaces allowed by Capability are '["default"]'.`,
    );
  });
  it("should not return missingCarriableNamespace reason when the object carries a namespace that is allowed by the capability", () => {
    const result = adjudicateMissingCarriableNamespace(["default"], {
      metadata: { namespace: "default" },
    });
    expect(result).toBe(null);
  });
});

describe("adjudicateMismatchedNamespaceRegex", () => {
  it("should return mismatchedNamespaceRegex reason when the binding regexNamespaces do not match the object namespace", () => {
    const result = adjudicateMismatchedNamespaceRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexNamespaces: ["^default$"] },
      },
      { metadata: { namespace: "not-default" } },
    );
    expect(result).toBe(
      `Binding defines namespace regexes '["^default$"]' but Object carries 'not-default'.`,
    );
  });
  it("should not return mismatchedNamespaceRegex reason when the binding regexNamespaces and object namespace match", () => {
    const result = adjudicateMismatchedNamespaceRegex(
      {
        ...clusterScopedBinding,
        filters: { ...clusterScopedBinding.filters, regexNamespaces: ["^default$"] },
      },
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
