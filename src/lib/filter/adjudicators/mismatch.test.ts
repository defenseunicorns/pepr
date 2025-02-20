// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding, DeepPartial } from "../../types";
import { defaultAdmissionRequest, defaultBinding, defaultFilters, defaultKubernetesObject } from "./defaultTestObjects";
import {
  mismatchedEvent,
  mismatchedGroup,
  mismatchedVersion,
  mismatchedKind,
  metasMismatch,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
} from "./mismatch";
import { Event, Operation } from "../../enums";

// TODO: There seems to be several instances of duplicated tests in this file
// TODO: There seems to be several instances of duplicated tests in this file
// TODO: There seems to be several instances of duplicated tests in this file

describe("mismatchedName", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{ filters: { name: "name" } }, {}, true],
    [{ filters: { name: "name" } }, { metadata: { name: "name" } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, name: bnd.filters.name },
    };
    const kubernetesObject: KubernetesObject = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };

    const result = mismatchedName(binding, kubernetesObject);

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
    const kubernetesObject = obj as DeepPartial<KubernetesObject>;

    const result = mismatchedDeletionTimestamp(binding, kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("mismatchedName", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{ filters: { name: "name" } }, {}, true],
    [{ filters: { name: "name" } }, { metadata: { name: "name" } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, name: bnd.filters.name },
    };

    const kubernetesObject: KubernetesObject = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };

    const result = mismatchedName(binding, kubernetesObject);

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

    const result = mismatchedNameRegex(binding, object);

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
    const kubernetesObject = obj as DeepPartial<KubernetesObject>;

    const result = mismatchedNameRegex(binding, kubernetesObject);

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

    const result = mismatchedNamespace(binding, object);

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
    const kubernetesObject = obj as DeepPartial<KubernetesObject>;

    const result = mismatchedNamespace(binding, kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("mismatchedNamespaceRegex", () => {
  //[ Binding, KubernetesObject, result ]
  const testRegex1 = "^n[aeiou]mespace$"; //regexr.com/89l8f
  const testRegex2 = "^n[aeiou]me$"; //regexr.com/89l8l
  const testRegex3 = "^sp[aeiou]ce$"; //regexr.com/89l8o
  it.each([
    [{ filters: { regexNamespaces: [new RegExp("^n.mespace$").source] } }, {}, true],

    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "namespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "nemespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "nimespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "nomespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "numespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex1] } }, { metadata: { namespace: "n3mespace" } }, true],

    [{ filters: { regexNamespaces: [testRegex2, testRegex3] } }, { metadata: { namespace: "name" } }, false],
    [{ filters: { regexNamespaces: [testRegex2, testRegex3] } }, { metadata: { namespace: "space" } }, false],
    [{ filters: { regexNamespaces: [testRegex2, testRegex3] } }, { metadata: { namespace: "namespace" } }, true],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, regexNamespaces: bnd.filters.regexNamespaces },
    };
    const kubernetesObject: KubernetesObject = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };
    const result = mismatchedNamespaceRegex(binding, kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("mismatchedNamespaceRegex", () => {
  //[ Binding, KubernetesObject, result ]
  const testRegex1 = "^n.mespace$"; //regexr.com/89l8u
  const testRegex2 = "^n[aeiou]mespace$"; //regexr.com/89l8f
  const testRegex3 = "^n[aeiou]me$"; //regexr.com/89l8l
  const testRegex4 = "^sp[aeiou]ce$"; //regexr.com/89l8o

  it.each([
    [{ filters: { regexNamespaces: [testRegex1] } }, {}, true],

    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "namespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "nemespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "nimespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "nomespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "numespace" } }, false],
    [{ filters: { regexNamespaces: [testRegex2] } }, { metadata: { namespace: "n3mespace" } }, true],

    [{ filters: { regexNamespaces: [testRegex3, testRegex4] } }, { metadata: { namespace: "name" } }, false],
    [{ filters: { regexNamespaces: [testRegex3, testRegex4] } }, { metadata: { namespace: "space" } }, false],
    [{ filters: { regexNamespaces: [testRegex3, testRegex4] } }, { metadata: { namespace: "namespace" } }, true],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, regexNamespaces: bnd.filters.regexNamespaces },
    };
    const kubernetesObject: KubernetesObject = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };

    const result = mismatchedNamespaceRegex(binding, kubernetesObject);

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

    const result = mismatchedAnnotations(binding, object);

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
    const kubernetesObject = obj as DeepPartial<KubernetesObject>;

    const result = mismatchedAnnotations(binding, kubernetesObject);

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

    const result = mismatchedLabels(binding, object);

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
    const kubernetesObject = obj as DeepPartial<KubernetesObject>;

    const result = mismatchedLabels(binding, kubernetesObject);

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
    const result = metasMismatch(bnd, obj);

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
    const result = metasMismatch(bnd, obj);

    expect(result).toBe(expected);
  });
});

describe("mismatchedEvent", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
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
    const binding: Binding = {
      ...defaultBinding,
      event: bnd.event,
    };
    const request: AdmissionRequest = {
      ...defaultAdmissionRequest,
      operation: req.operation,
    };

    const result = mismatchedEvent(binding, request);

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

    const result = mismatchedGroup(binding, request);

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

    const result = mismatchedVersion(binding, request);

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

    const result = mismatchedKind(binding, request);

    expect(result).toEqual(expected);
  });
});
