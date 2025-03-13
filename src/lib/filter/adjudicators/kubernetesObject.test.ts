// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";

import {
  carriedKind,
  carriedVersion,
  uncarryableNamespace,
  missingCarriableNamespace,
  carriesIgnoredNamespace,
} from "./kubernetesObject";

describe("carriedKind", () => {
  it.each([
    // Does carry kind
    [{ kind: "kind" }, "kind"],
    // does not carry kind
    [{}, "not set"],
  ])("given %j, returns '%s'", (given, expected) => {
    const result = carriedKind(given);
    expect(result).toEqual(expected);
  });
});

describe("carriedVersion", () => {
  it.each([
    // Does carry version
    [{ metadata: { resourceVersion: "version" } }, "version"],
    // does not carry version
    [{}, "not set"],
  ])("given %j, returns '%s'", (given, expected) => {
    const result = carriedVersion(given);
    expect(result).toEqual(expected);
  });
});

describe("uncarryableNamespace", () => {
  it.each([
    // namespaceSelector is empty, so the first condition (length > 0) fails - should return false
    [[], {}, false],
    // namespaceSelector is empty, Object has a namespace - should return false
    [[], { kind: "Namespace", metadata: { name: "namespace" } }, false],
    // namespaceSelector is default, object has default - should return false
    [["default"], { kind: "Namespace", metadata: { name: "default" } }, false],
    // namespaceSelector is kube-system, object has kube-public - should return true
    [["kube-system"], { kind: "Pod", metadata: { namespace: "kube-public" } }, true],
    // namespaceSelector is empty, object has namespace - should return false
    [[], { metadata: { namespace: "namespace" } }, false],
    // nameSpaceSelector is kube-system, object is cluster-scoped and has no namespace, should return false
    [["kube-system"], { kind: "ClusterRole", metadata: { name: "cluster-admin" } }, false],
  ])("given %j and %j, returns %s", (namespaceSelector, kubernetesObject, expected) => {
    const result = uncarryableNamespace(namespaceSelector, kubernetesObject);
    expect(result).toEqual(expected);
  });
});

describe("missingCarriableNamespace", () => {
  it.each([
    // namespaceSelector is empty, so the first condition (length > 0) fails - should return false
    [[], {}, false],

    // Object has a namespace - should return false
    [["namespace"], { metadata: { namespace: "namespace" } }, false],

    // Namespace object, but its name is not in namespaceSelector - should return true
    [["some-other-namespace"], { kind: "Namespace", metadata: { name: "namespace" } }, true],

    // Pod with a namespace - should return false
    [["kube-public"], { kind: "Pod", metadata: { namespace: "kube-public" } }, false],
  ])(
    "given namespaceSelector %j and kubernetesObject %j, returns %s",
    (namespaceSelector, kubernetesObject, expected) => {
      const result = missingCarriableNamespace(namespaceSelector, kubernetesObject);
      expect(result).toEqual(expected);
    },
  );
});

describe("carriesIgnoredNamespace", () => {
  it.each([
    // namespaceSelector is empty, so the first condition (length > 0) fails - should return false
    [[], {}, false],

    // Object carries ignoredNamespace - should return true
    [["namespace"], { metadata: { namespace: "namespace" } }, true],

    // Ignored namespace is different thatn the namespace name
    [["some-other-namespace"], { kind: "Namespace", metadata: { name: "namespace" } }, false],

    // Pod with a namespace that is an ignored namespace - should return true
    [["kube-public"], { kind: "Pod", metadata: { namespace: "kube-public" } }, true],

    // Cluster-scoped object with no namespace - should return false
    [["kube-system"], { kind: "ClusterRole", metadata: { name: "cluster-admin" } }, false],
  ])(
    "given namespaceSelector %j and kubernetesObject %j, returns %s",
    (namespaceSelector, kubernetesObject, expected) => {
      const result = carriesIgnoredNamespace(namespaceSelector, kubernetesObject);
      expect(result).toEqual(expected);
    },
  );
});
