// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import * as sut from "./adjudicators";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding, DeepPartial } from "../types";
import { Event, Operation } from "../enums";

describe("carriesDeletionTimestamp", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, false],
    [{ metadata: {} }, false],
    [{ metadata: { deletionTimestamp: null } }, false],
    [{ metadata: { deletionTimestamp: new Date() } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const ko = given as DeepPartial<KubernetesObject>;

    const result = sut.carriesDeletionTimestamp(ko);

    expect(result).toBe(expected);
  });
});

describe("missingDeletionTimestamp", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, true],
    [{ metadata: {} }, true],
    [{ metadata: { deletionTimestamp: null } }, true],
    [{ metadata: { deletionTimestamp: new Date() } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const ko = given as DeepPartial<KubernetesObject>;

    const result = sut.missingDeletionTimestamp(ko);

    expect(result).toBe(expected);
  });
});

describe("mismatchedDeletionTimestamp", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { deletionTimestamp: new Date() } }, false],
    [{ filters: { deletionTimestamp: true } }, {}, true],
    [{ filters: { deletionTimestamp: true } }, { metadata: { deletionTimestamp: new Date() } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<KubernetesObject>;

    const result = sut.mismatchedDeletionTimestamp(binding, object);

    expect(result).toBe(expected);
  });
});

describe("mismatchedName", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { name: "name" } }, false],
    [{ filters: { name: "name" } }, {}, true],
    [{ filters: { name: "name" } }, { metadata: { name: "name" } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<KubernetesObject>;

    const result = sut.mismatchedName(binding, object);

    expect(result).toBe(expected);
  });
});

describe("mismatchedNameRegex", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { name: "name" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, {}, true],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "name" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "neme" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "nime" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "nome" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "nume" } }, false],
    [{ filters: { regexName: "^n[aeiou]me$" } }, { metadata: { name: "n3me" } }, true],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<KubernetesObject>;

    const result = sut.mismatchedNameRegex(binding, object);

    expect(result).toBe(expected);
  });
});

describe("bindsToKind", () => {
  //[ Binding, Kind, result ]
  it.each([
    [{}, "", false],
    [{ kind: {} }, "", false],
    [{ kind: { kind: null } }, "", false],
    [{ kind: { kind: "" } }, "", false],
    [{}, "Kind", false],
    [{ kind: {} }, "Kind", false],
    [{ kind: { kind: null } }, "Kind", false],
    [{ kind: { kind: "" } }, "Kind", false],
    [{ kind: { kind: "Kind" } }, "Kind", true],
  ])("given binding %j, and kind '%s', returns %s", (bnd, knd, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const kind = knd as string;

    const result = sut.bindsToKind(binding, kind);

    expect(result).toBe(expected);
  });
});

describe("mismatchedNamespace", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { namespace: "namespace" } }, false],
    [{ filters: { namespaces: ["namespace"] } }, {}, true],
    [{ filters: { namespaces: ["namespace"] } }, { metadata: { namespace: "nopesause" } }, true],
    [{ filters: { namespaces: ["namespace"] } }, { metadata: { namespace: "namespace" } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<Binding>;

    const result = sut.mismatchedNamespace(binding, object);

    expect(result).toBe(expected);
  });
});

describe("mismatchedNamespaceRegex", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { namespace: "namespace" } }, false],
    [{ filters: { regexNamespaces: ["^n.mespace$"] } }, {}, true],

    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "namespace" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "nemespace" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "nimespace" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "nomespace" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "numespace" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]mespace$"] } }, { metadata: { namespace: "n3mespace" } }, true],

    [{ filters: { regexNamespaces: ["^n[aeiou]me$", "^sp[aeiou]ce$"] } }, { metadata: { namespace: "name" } }, false],
    [{ filters: { regexNamespaces: ["^n[aeiou]me$", "^sp[aeiou]ce$"] } }, { metadata: { namespace: "space" } }, false],
    [
      { filters: { regexNamespaces: ["^n[aeiou]me$", "^sp[aeiou]ce$"] } },
      { metadata: { namespace: "namespace" } },
      true,
    ],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<Binding>;

    const result = sut.mismatchedNamespaceRegex(binding, object);

    expect(result).toBe(expected);
  });
});

describe("metasMismatch", () => {
  it.each([
    [{}, {}, false],
    [{}, { anno: "tate" }, false],

    [{ anno: "" }, {}, true],
    [{ anno: "" }, { anno: "" }, false],
    [{ anno: "" }, { anno: "tate" }, false],

    [{ anno: "tate" }, {}, true],
    [{ anno: "tate" }, { anno: "" }, true],
    [{ anno: "tate" }, { anno: "tate" }, false],
    [{ anno: "tate" }, { anno: "tato" }, true],

    [{ an: "no", ta: "te" }, { an: "" }, true],
    [{ an: "no", ta: "te" }, { an: "no" }, true],
    [{ an: "no", ta: "te" }, { an: "no", ta: "" }, true],
    [{ an: "no", ta: "te" }, { an: "no", ta: "te" }, false],
    [{ an: "no", ta: "te" }, { an: "no", ta: "to" }, true],
  ])("given left %j and right %j, returns %s", (bnd, obj, expected) => {
    const result = sut.metasMismatch(bnd, obj);

    expect(result).toBe(expected);
  });
});

describe("mismatchedAnnotations", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { annotations: { anno: "tate" } } }, false],

    [{ filters: { annotations: { anno: "" } } }, {}, true],
    [{ filters: { annotations: { anno: "" } } }, { metadata: { annotations: { anno: "" } } }, false],
    [{ filters: { annotations: { anno: "" } } }, { metadata: { annotations: { anno: "tate" } } }, false],

    [{ filters: { annotations: { anno: "tate" } } }, {}, true],
    [{ filters: { annotations: { anno: "tate" } } }, { metadata: { annotations: { anno: "" } } }, true],
    [{ filters: { annotations: { anno: "tate" } } }, { metadata: { annotations: { anno: "tate" } } }, false],
    [{ filters: { annotations: { anno: "tate" } } }, { metadata: { annotations: { anno: "tato" } } }, true],

    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "" } } }, true],
    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "no" } } }, true],
    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "no", ta: "" } } }, true],
    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "no", ta: "to" } } }, true],
    [
      { filters: { annotations: { an: "no", ta: "te" } } },
      { metadata: { annotations: { an: "no", ta: "te" } } },
      false,
    ],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<Binding>;

    const result = sut.mismatchedAnnotations(binding, object);

    expect(result).toBe(expected);
  });
});

describe("mismatchedLabels", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { labels: { la: "ble" } } }, false],

    [{ filters: { labels: { la: "" } } }, {}, true],
    [{ filters: { labels: { la: "" } } }, { metadata: { labels: { la: "" } } }, false],
    [{ filters: { labels: { la: "" } } }, { metadata: { labels: { la: "ble" } } }, false],

    [{ filters: { labels: { la: "ble" } } }, {}, true],
    [{ filters: { labels: { la: "ble" } } }, { metadata: { labels: { la: "" } } }, true],
    [{ filters: { labels: { la: "ble" } } }, { metadata: { labels: { la: "ble" } } }, false],

    [{ filters: { labels: { l: "a", b: "le" } } }, { metadata: { labels: { l: "" } } }, true],
    [{ filters: { labels: { l: "a", b: "le" } } }, { metadata: { labels: { l: "a" } } }, true],
    [{ filters: { labels: { l: "a", b: "le" } } }, { metadata: { labels: { l: "a", b: "" } } }, true],
    [{ filters: { labels: { l: "a", b: "le" } } }, { metadata: { labels: { l: "a", b: "le" } } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const object = obj as DeepPartial<Binding>;

    const result = sut.mismatchedLabels(binding, object);

    expect(result).toBe(expected);
  });
});

describe("missingCarriableNamespace", () => {
  //[ capa ns's, KubernetesObject, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "namespace" } }, false],

    [["namespace"], {}, true],
    [["namespace"], { metadata: {} }, true],
    [["namespace"], { metadata: { namespace: null } }, true],
    [["namespace"], { metadata: { namespace: "" } }, true],
    [["namespace"], { metadata: { namespace: "incorrect" } }, false],
    [["namespace"], { metadata: { namespace: "namespace" } }, false],

    [["name", "space"], {}, true],
    [["name", "space"], { metadata: {} }, true],
    [["name", "space"], { metadata: { namespace: null } }, true],
    [["name", "space"], { metadata: { namespace: "" } }, true],
    [["name", "space"], { metadata: { namespace: "incorrect" } }, false],
    [["name", "space"], { metadata: { namespace: "name" } }, false],
    [["name", "space"], { metadata: { namespace: "space" } }, false],
    [["ingress-controller"], { kind: "Namespace", metadata: { name: "ingress-controller" } }, false],
    [["ingress-controller"], { kind: "Namespace", metadata: { name: "egress-controller" } }, true],
  ])("given capabilityNamespaces %j and object %j, returns %s", (nss, obj, expected) => {
    const object = obj as DeepPartial<KubernetesObject>;

    const result = sut.missingCarriableNamespace(nss, object);

    expect(result).toBe(expected);
  });
});

describe("uncarryableNamespace", () => {
  //[ capa ns's, KubernetesObject, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "namespace" } }, false],

    [["namespace"], {}, false],
    [["namespace"], { metadata: {} }, false],
    [["namespace"], { metadata: { namespace: null } }, false],
    [["namespace"], { metadata: { namespace: "" } }, false],
    [["namespace"], { metadata: { namespace: "incorrect" } }, true],
    [["namespace"], { metadata: { namespace: "namespace" } }, false],

    [["name", "space"], {}, false],
    [["name", "space"], { metadata: {} }, false],
    [["name", "space"], { metadata: { namespace: null } }, false],
    [["name", "space"], { metadata: { namespace: "" } }, false],
    [["name", "space"], { metadata: { namespace: "incorrect" } }, true],
    [["name", "space"], { metadata: { namespace: "name" } }, false],
    [["name", "space"], { metadata: { namespace: "space" } }, false],
  ])("given capabilityNamespaces %j and object %j, returns %s", (nss, obj, expected) => {
    const object = obj as DeepPartial<Binding>;

    const result = sut.uncarryableNamespace(nss, object);

    expect(result).toBe(expected);
  });
});

describe("carriesIgnoredNamespace", () => {
  //[ ignored ns's, KubernetesObject, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "whatever" } }, false],

    [["ignored"], {}, false],
    [["ignored"], { metadata: {} }, false],
    [["ignored"], { metadata: { namespace: null } }, false],
    [["ignored"], { metadata: { namespace: "" } }, false],
    [["ignored"], { metadata: { namespace: "namespace" } }, false],
    [["ignored"], { metadata: { namespace: "ignored" } }, true],

    [["ign", "ored"], {}, false],
    [["ign", "ored"], { metadata: {} }, false],
    [["ign", "ored"], { metadata: { namespace: null } }, false],
    [["ign", "ored"], { metadata: { namespace: "" } }, false],
    [["ign", "ored"], { metadata: { namespace: "ign" } }, true],
    [["ign", "ored"], { metadata: { namespace: "ored" } }, true],
    [["ign", "ored"], { metadata: { namespace: "namespace" } }, false],
  ])("given capabilityNamespaces %j and object %j, returns %s", (nss, obj, expected) => {
    const object = obj as DeepPartial<Binding>;

    const result = sut.carriesIgnoredNamespace(nss, object);

    expect(result).toBe(expected);
  });
});

describe("unbindableNamespaces", () => {
  //[ capa ns's, Binding, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "namespace" } }, false],

    [["namespace"], {}, false],
    [["namespace"], { filters: {} }, false],
    [["namespace"], { filters: { namespaces: null } }, false],
    [["namespace"], { filters: { namespaces: [] } }, false],
    [["namespace"], { filters: { namespaces: ["incorrect"] } }, true],
    [["namespace"], { filters: { namespaces: ["namespace"] } }, false],

    [["name", "space"], {}, false],
    [["name", "space"], { filters: {} }, false],
    [["name", "space"], { filters: { namespaces: null } }, false],
    [["name", "space"], { filters: { namespaces: [] } }, false],
    [["name", "space"], { filters: { namespaces: ["namespace"] } }, true],
    [["name", "space"], { filters: { namespaces: ["name"] } }, false],
    [["name", "space"], { filters: { namespaces: ["space"] } }, false],
    [["name", "space"], { filters: { namespaces: ["incorrect", "space"] } }, true],
  ])("given capabilityNamespaces %j and binding %j, returns %s", (nss, bnd, expected) => {
    const binding = bnd as DeepPartial<Binding>;

    const result = sut.unbindableNamespaces(nss, binding);

    expect(result).toBe(expected);
  });
});

describe("operationMatchesEvent", () => {
  //[ Operation, Event, result ]
  it.each([
    ["", "", true],
    ["", Event.CREATE, false],
    [Operation.CREATE, "", false],

    [Operation.CREATE, Event.CREATE, true],
    [Operation.CREATE, Event.UPDATE, false],
    [Operation.CREATE, Event.DELETE, false],
    [Operation.CREATE, Event.CREATE_OR_UPDATE, true],
    [Operation.CREATE, Event.ANY, true],

    [Operation.UPDATE, Event.CREATE, false],
    [Operation.UPDATE, Event.UPDATE, true],
    [Operation.UPDATE, Event.DELETE, false],
    [Operation.UPDATE, Event.CREATE_OR_UPDATE, true],
    [Operation.UPDATE, Event.ANY, true],

    [Operation.DELETE, Event.CREATE, false],
    [Operation.DELETE, Event.UPDATE, false],
    [Operation.DELETE, Event.DELETE, true],
    [Operation.DELETE, Event.CREATE_OR_UPDATE, false],
    [Operation.DELETE, Event.ANY, true],

    [Operation.CONNECT, Event.CREATE, false],
    [Operation.CONNECT, Event.UPDATE, false],
    [Operation.CONNECT, Event.DELETE, false],
    [Operation.CONNECT, Event.CREATE_OR_UPDATE, false],
    [Operation.CONNECT, Event.ANY, true],
  ])("given operation %s and event %s, returns %s", (op, evt, expected) => {
    const result = sut.operationMatchesEvent(op, evt);

    expect(result).toEqual(expected);
  });
});

describe("mismatchedEvent", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
    [{}, {}, false],
    [{}, { operation: Operation.CREATE }, true],
    [{ event: Event.CREATE }, {}, true],

    [{ event: Event.CREATE }, { operation: Operation.CREATE }, false],
    [{ event: Event.UPDATE }, { operation: Operation.CREATE }, true],
    [{ event: Event.DELETE }, { operation: Operation.CREATE }, true],
    [{ event: Event.CREATE_OR_UPDATE }, { operation: Operation.CREATE }, false],
    [{ event: Event.ANY }, { operation: Operation.CREATE }, false],

    [{ event: Event.CREATE }, { operation: Operation.UPDATE }, true],
    [{ event: Event.UPDATE }, { operation: Operation.UPDATE }, false],
    [{ event: Event.DELETE }, { operation: Operation.UPDATE }, true],
    [{ event: Event.CREATE_OR_UPDATE }, { operation: Operation.UPDATE }, false],
    [{ event: Event.ANY }, { operation: Operation.UPDATE }, false],

    [{ event: Event.CREATE }, { operation: Operation.DELETE }, true],
    [{ event: Event.UPDATE }, { operation: Operation.DELETE }, true],
    [{ event: Event.DELETE }, { operation: Operation.DELETE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, { operation: Operation.DELETE }, true],
    [{ event: Event.ANY }, { operation: Operation.DELETE }, false],

    [{ event: Event.CREATE }, { operation: Operation.CONNECT }, true],
    [{ event: Event.UPDATE }, { operation: Operation.CONNECT }, true],
    [{ event: Event.DELETE }, { operation: Operation.CONNECT }, true],
    [{ event: Event.CREATE_OR_UPDATE }, { operation: Operation.CONNECT }, true],
    [{ event: Event.ANY }, { operation: Operation.CONNECT }, false],
  ])("given binding %j and admission request %j, returns %s", (bnd, req, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const request = req as DeepPartial<AdmissionRequest>;

    const result = sut.mismatchedEvent(binding, request);

    expect(result).toEqual(expected);
  });
});

describe("mismatchedGroup", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
    [{}, {}, false],
    [{}, { kind: { group: "group" } }, false],
    [{ kind: { group: "group" } }, {}, true],
    [{ kind: { group: "group" } }, { kind: { group: "wrong" } }, true],
    [{ kind: { group: "group" } }, { kind: { group: "group" } }, false],
  ])("given binding %j and admission request %j, returns %s", (bnd, req, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const request = req as DeepPartial<AdmissionRequest>;

    const result = sut.mismatchedGroup(binding, request);

    expect(result).toEqual(expected);
  });
});

describe("mismatchedVersion", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
    [{}, {}, false],
    [{}, { kind: { version: "version" } }, false],
    [{ kind: { version: "version" } }, {}, true],
    [{ kind: { version: "version" } }, { kind: { version: "wrong" } }, true],
    [{ kind: { version: "version" } }, { kind: { version: "version" } }, false],
  ])("given binding %j and admission request %j, returns %s", (bnd, req, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const request = req as DeepPartial<AdmissionRequest>;

    const result = sut.mismatchedVersion(binding, request);

    expect(result).toEqual(expected);
  });
});

describe("mismatchedKind", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
    [{}, {}, false],
    [{}, { kind: { kind: "kind" } }, false],
    [{ kind: { kind: "kind" } }, {}, true],
    [{ kind: { kind: "kind" } }, { kind: { kind: "wrong" } }, true],
    [{ kind: { kind: "kind" } }, { kind: { kind: "kind" } }, false],
  ])("given binding %j and admission request %j, returns %s", (bnd, req, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const request = req as DeepPartial<AdmissionRequest>;

    const result = sut.mismatchedKind(binding, request);

    expect(result).toEqual(expected);
  });
});
