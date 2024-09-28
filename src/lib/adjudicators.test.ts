// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import * as sut from "./adjudicators";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding, DeepPartial, Event, Operation } from "./types";

describe("definesDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { deletionTimestamp: null } }, false],
    [{ filters: { deletionTimestamp: false } }, false],
    [{ filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesDeletionTimestamp(binding);

    expect(result).toBe(expected);
  });
});

describe("ignoresDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{}, true],
    [{ filters: {} }, true],
    [{ filters: { deletionTimestamp: null } }, true],
    [{ filters: { deletionTimestamp: false } }, true],
    [{ filters: { deletionTimestamp: true } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.ignoresDeletionTimestamp(binding);

    expect(result).toBe(expected);
  });
});

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

describe("definedName", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ filters: {} }, ""],
    [{ filters: { name: null } }, ""],
    [{ filters: { name: "name" } }, "name"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedName(binding);

    expect(result).toBe(expected);
  });
});

describe("definesName", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { name: null } }, false],
    [{ filters: { name: "name" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesName(binding);

    expect(result).toBe(expected);
  });
});

describe("ignoresName", () => {
  //[ Binding, result ]
  it.each([
    [{}, true],
    [{ filters: {} }, true],
    [{ filters: { name: null } }, true],
    [{ filters: { name: "name" } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.ignoresName(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedName", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, ""],
    [{ metadata: {} }, ""],
    [{ metadata: { name: null } }, ""],
    [{ metadata: { name: "name" } }, "name"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.carriedName(binding);

    expect(result).toBe(expected);
  });
});

describe("carriesName", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, false],
    [{ metadata: {} }, false],
    [{ metadata: { name: null } }, false],
    [{ metadata: { name: "name" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.carriesName(binding);

    expect(result).toBe(expected);
  });
});

describe("missingName", () => {
  //[ Binding, result ]
  it.each([
    [{}, true],
    [{ metadata: {} }, true],
    [{ metadata: { name: null } }, true],
    [{ metadata: { name: "name" } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.missingName(binding);

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

describe("bindsToNamespace", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ kind: {} }, false],
    [{ kind: { kind: null } }, false],
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "Namespace" } }, true],
  ])("given binding %j returns %s", (bnd, expected) => {
    const binding = bnd as DeepPartial<Binding>;

    const result = sut.bindsToNamespace(binding);

    expect(result).toBe(expected);
  });
});

describe("definedNamespaces", () => {
  //[ Binding, result ]
  it.each([
    [{}, []],
    [{ filters: {} }, []],
    [{ filters: { namespaces: null } }, []],
    [{ filters: { namespaces: [] } }, []],
    [{ filters: { namespaces: ["namespace"] } }, ["namespace"]],
    [{ filters: { namespaces: ["name", "space"] } }, ["name", "space"]],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedNamespaces(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesNamespaces", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { namespaces: null } }, false],
    [{ filters: { namespaces: [] } }, false],
    [{ filters: { namespaces: ["namespace"] } }, true],
    [{ filters: { namespaces: ["name", "space"] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesNamespaces(binding);

    expect(result).toBe(expected);
  });
});

describe("definedNamespaceRegexes", () => {
  //[ Binding, result ]
  it.each([
    [{}, []],
    [{ filters: {} }, []],
    [{ filters: { regexNamespaces: null } }, []],
    [{ filters: { regexNamespaces: [] } }, []],
    [{ filters: { regexNamespaces: ["n.mesp.ce"] } }, ["n.mesp.ce"]],
    [{ filters: { regexNamespaces: ["n.me", "sp.ce"] } }, ["n.me", "sp.ce"]],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedNamespaceRegexes(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesNamespaceRegexes", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { regexNamespaces: null } }, false],
    [{ filters: { regexNamespaces: [] } }, false],
    [{ filters: { regexNamespaces: ["n.mesp.ce"] } }, true],
    [{ filters: { regexNamespaces: ["n.me", "sp.ce"] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesNamespaceRegexes(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedNamespace", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, ""],
    [{ metadata: {} }, ""],
    [{ metadata: { namespace: null } }, ""],
    [{ metadata: { namespace: "" } }, ""],
    [{ metadata: { namespace: "namespace" } }, "namespace"],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.carriedNamespace(binding);

    expect(result).toEqual(expected);
  });
});

describe("carriesNamespace", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, false],
    [{ metadata: {} }, false],
    [{ metadata: { namespace: null } }, false],
    [{ metadata: { namespace: "" } }, false],
    [{ metadata: { namespace: "namespace" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.carriesNamespace(binding);

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

describe("misboundNamespace", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { kind: "Kind" }, filters: { namespaces: [] } }, false],
    [{ kind: { kind: "Kind" }, filters: { namespaces: ["namespace"] } }, false],
    [{ kind: { kind: "Namespace" }, filters: { namespaces: [] } }, false],
    [{ kind: { kind: "Namespace" }, filters: { namespaces: ["namespace"] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.misboundNamespace(binding);

    expect(result).toBe(expected);
  });
});

describe("definedAnnotations", () => {
  //[ Binding, result ]
  it.each([
    [{}, {}],
    [{ filters: {} }, {}],
    [{ filters: { annotations: null } }, {}],
    [{ filters: { annotations: {} } }, {}],
    [{ filters: { annotations: { annotation: "" } } }, { annotation: "" }],
    [{ filters: { annotations: { anno: "tation" } } }, { anno: "tation" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedAnnotations(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesAnnotations", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { annotations: null } }, false],
    [{ filters: { annotations: {} } }, false],
    [{ filters: { annotations: { annotation: "" } } }, true],
    [{ filters: { annotations: { anno: "tation" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesAnnotations(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedAnnotations", () => {
  //[ KuberneteObject, result ]
  it.each([
    [{}, {}],
    [{ metadata: {} }, {}],
    [{ metadata: { annotations: null } }, {}],
    [{ metadata: { annotations: {} } }, {}],
    [{ metadata: { annotations: { annotation: "" } } }, { annotation: "" }],
    [{ metadata: { annotations: { anno: "tation" } } }, { anno: "tation" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<KubernetesObject>;

    const result = sut.carriedAnnotations(binding);

    expect(result).toEqual(expected);
  });
});

describe("carriesAnnotations", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, false],
    [{ metadata: {} }, false],
    [{ metadata: { annotations: null } }, false],
    [{ metadata: { annotations: {} } }, false],
    [{ metadata: { annotations: { annotation: "" } } }, true],
    [{ metadata: { annotations: { anno: "tation" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<KubernetesObject>;

    const result = sut.carriesAnnotations(binding);

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

    [{ an: "no", ta: "te" }, { an: "" }, true],
    [{ an: "no", ta: "te" }, { an: "no" }, true],
    [{ an: "no", ta: "te" }, { an: "no", ta: "" }, true],
    [{ an: "no", ta: "te" }, { an: "no", ta: "te" }, false],
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

    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "" } } }, true],
    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "no" } } }, true],
    [{ filters: { annotations: { an: "no", ta: "te" } } }, { metadata: { annotations: { an: "no", ta: "" } } }, true],
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

describe("definedLabels", () => {
  //[ Binding, result ]
  it.each([
    [{}, {}],
    [{ filters: {} }, {}],
    [{ filters: { labels: null } }, {}],
    [{ filters: { labels: {} } }, {}],
    [{ filters: { labels: { label: "" } } }, { label: "" }],
    [{ filters: { labels: { lab: "el" } } }, { lab: "el" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedLabels(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesLabels", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { labels: null } }, false],
    [{ filters: { labels: {} } }, false],
    [{ filters: { labels: { label: "" } } }, true],
    [{ filters: { labels: { lab: "el" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesLabels(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedLabels", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, {}],
    [{ metadata: {} }, {}],
    [{ metadata: { labels: null } }, {}],
    [{ metadata: { labels: {} } }, {}],
    [{ metadata: { labels: { label: "" } } }, { label: "" }],
    [{ metadata: { labels: { lab: "el" } } }, { lab: "el" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = given as DeepPartial<KubernetesObject>;

    const result = sut.carriedLabels(binding);

    expect(result).toEqual(expected);
  });
});

describe("carriesLabels", () => {
  //[ KubernetesObject, result ]
  it.each([
    [{}, false],
    [{ metadata: {} }, false],
    [{ metadata: { labels: null } }, false],
    [{ metadata: { labels: {} } }, false],
    [{ metadata: { labels: { label: "" } } }, true],
    [{ metadata: { labels: { lab: "el" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<KubernetesObject>;

    const result = sut.carriesLabels(binding);

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

describe("definedEvent", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ event: "" }, ""],
    [{ event: "nonsense" }, "nonsense"],
    [{ event: Event.Create }, Event.Create],
    [{ event: Event.CreateOrUpdate }, Event.CreateOrUpdate],
    [{ event: Event.Update }, Event.Update],
    [{ event: Event.Delete }, Event.Delete],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedEvent(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesDelete", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ event: "" }, false],
    [{ event: "nonsense" }, false],
    [{ event: Event.Create }, false],
    [{ event: Event.CreateOrUpdate }, false],
    [{ event: Event.Update }, false],
    [{ event: Event.Delete }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesDelete(binding);

    expect(result).toEqual(expected);
  });
});

describe("misboundDeleteWithDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ event: "" }, false],
    [{ event: "nonsense" }, false],
    [{ event: Event.Create }, false],
    [{ event: Event.CreateOrUpdate }, false],
    [{ event: Event.Update }, false],
    [{ event: Event.Delete }, false],
    [{ event: Event.Delete, filters: {} }, false],
    [{ event: Event.Delete, filters: { deletionTimestamp: false } }, false],
    [{ event: Event.Delete, filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.misboundDeleteWithDeletionTimestamp(binding);

    expect(result).toEqual(expected);
  });
});

describe("operationMatchesEvent", () => {
  //[ Operation, Event, result ]
  it.each([
    ["", "", true],
    ["", Event.Create, false],
    [Operation.CREATE, "", false],

    [Operation.CREATE, Event.Create, true],
    [Operation.CREATE, Event.Update, false],
    [Operation.CREATE, Event.Delete, false],
    [Operation.CREATE, Event.CreateOrUpdate, true],
    [Operation.CREATE, Event.Any, true],

    [Operation.UPDATE, Event.Create, false],
    [Operation.UPDATE, Event.Update, true],
    [Operation.UPDATE, Event.Delete, false],
    [Operation.UPDATE, Event.CreateOrUpdate, true],
    [Operation.UPDATE, Event.Any, true],

    [Operation.DELETE, Event.Create, false],
    [Operation.DELETE, Event.Update, false],
    [Operation.DELETE, Event.Delete, true],
    [Operation.DELETE, Event.CreateOrUpdate, false],
    [Operation.DELETE, Event.Any, true],

    [Operation.CONNECT, Event.Create, false],
    [Operation.CONNECT, Event.Update, false],
    [Operation.CONNECT, Event.Delete, false],
    [Operation.CONNECT, Event.CreateOrUpdate, false],
    [Operation.CONNECT, Event.Any, true],
  ])("given operation %s and event %s, returns %s", (op, evt, expected) => {
    const result = sut.operationMatchesEvent(op, evt);

    expect(result).toEqual(expected);
  });
});

describe("declaredOperation", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ operation: null }, ""],
    [{ operation: "" }, ""],
    [{ operation: "operation" }, "operation"],
    [{ operation: Operation.CONNECT }, Operation.CONNECT],
    [{ operation: Operation.CREATE }, Operation.CREATE],
    [{ operation: Operation.UPDATE }, Operation.UPDATE],
    [{ operation: Operation.DELETE }, Operation.DELETE],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = given as DeepPartial<AdmissionRequest>;

    const result = sut.declaredOperation(request);

    expect(result).toEqual(expected);
  });
});

describe("mismatchedEvent", () => {
  //[ Binding, AdmissionRequest, result ]
  it.each([
    [{}, {}, false],
    [{}, { operation: Operation.CREATE }, true],
    [{ event: Event.Create }, {}, true],

    [{ event: Event.Create }, { operation: Operation.CREATE }, false],
    [{ event: Event.Update }, { operation: Operation.CREATE }, true],
    [{ event: Event.Delete }, { operation: Operation.CREATE }, true],
    [{ event: Event.CreateOrUpdate }, { operation: Operation.CREATE }, false],
    [{ event: Event.Any }, { operation: Operation.CREATE }, false],

    [{ event: Event.Create }, { operation: Operation.UPDATE }, true],
    [{ event: Event.Update }, { operation: Operation.UPDATE }, false],
    [{ event: Event.Delete }, { operation: Operation.UPDATE }, true],
    [{ event: Event.CreateOrUpdate }, { operation: Operation.UPDATE }, false],
    [{ event: Event.Any }, { operation: Operation.UPDATE }, false],

    [{ event: Event.Create }, { operation: Operation.DELETE }, true],
    [{ event: Event.Update }, { operation: Operation.DELETE }, true],
    [{ event: Event.Delete }, { operation: Operation.DELETE }, false],
    [{ event: Event.CreateOrUpdate }, { operation: Operation.DELETE }, true],
    [{ event: Event.Any }, { operation: Operation.DELETE }, false],

    [{ event: Event.Create }, { operation: Operation.CONNECT }, true],
    [{ event: Event.Update }, { operation: Operation.CONNECT }, true],
    [{ event: Event.Delete }, { operation: Operation.CONNECT }, true],
    [{ event: Event.CreateOrUpdate }, { operation: Operation.CONNECT }, true],
    [{ event: Event.Any }, { operation: Operation.CONNECT }, false],
  ])("given binding %j and admission request %j, returns %s", (bnd, req, expected) => {
    const binding = bnd as DeepPartial<Binding>;
    const request = req as DeepPartial<AdmissionRequest>;

    const result = sut.mismatchedEvent(binding, request);

    expect(result).toEqual(expected);
  });
});

describe("definedGroup", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { group: null } }, ""],
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesGroup", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ kind: null }, false],
    [{ kind: {} }, false],
    [{ kind: { group: null } }, false],
    [{ kind: { group: "" } }, false],
    [{ kind: { group: "group" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("declaredGroup", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { group: null } }, ""],
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = given as DeepPartial<AdmissionRequest>;

    const result = sut.declaredGroup(request);

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

describe("definedVersion", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { version: null } }, ""],
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedVersion(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesVersion", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ kind: null }, false],
    [{ kind: {} }, false],
    [{ kind: { version: null } }, false],
    [{ kind: { version: "" } }, false],
    [{ kind: { version: "version" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesVersion(binding);

    expect(result).toEqual(expected);
  });
});

describe("declaredVersion", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { version: null } }, ""],
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = given as DeepPartial<AdmissionRequest>;

    const result = sut.declaredVersion(request);

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

describe("definedKind", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { kind: null } }, ""],
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedKind(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesKind", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ kind: null }, false],
    [{ kind: {} }, false],
    [{ kind: { kind: null } }, false],
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "kind" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesKind(binding);

    expect(result).toEqual(expected);
  });
});

describe("declaredKind", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { kind: null } }, ""],
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = given as DeepPartial<AdmissionRequest>;

    const result = sut.declaredKind(request);

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

describe("definedCategory", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ isValidate: true }, "Validate"],
    [{ isMutate: true }, "Mutate"],
    [{ isWatch: true }, "Watch"],
    [{ isFinalize: true, isWatch: true }, "Finalize"],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedCategory(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedCallback", () => {
  const validateCallback = () => {};
  const mutateCallback = () => {};
  const watchCallback = () => {};
  const finalizeCallback = () => {};

  //[ Binding, result ]
  it.each([
    [{}, null],
    [{ isValidate: true, validateCallback }, validateCallback],
    [{ isMutate: true, mutateCallback }, mutateCallback],
    [{ isWatch: true, watchCallback }, watchCallback],
    [{ isFinalize: true, finalizeCallback }, finalizeCallback],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedCallback(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedCallbackName", () => {
  const validateCallback = () => {};
  const mutateCallback = () => {};
  const watchCallback = () => {};
  const finalizeCallback = () => {};

  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ isValidate: true, validateCallback }, "validateCallback"],
    [{ isMutate: true, mutateCallback }, "mutateCallback"],
    [{ isWatch: true, watchCallback }, "watchCallback"],
    [{ isFinalize: true, finalizeCallback }, "finalizeCallback"],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedCallbackName(binding);

    expect(result).toEqual(expected);
  });
});

describe("declaredUid", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ uid: null }, ""],
    [{ uid: "uid" }, "uid"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = given as DeepPartial<AdmissionRequest>;

    const result = sut.declaredUid(request);

    expect(result).toEqual(expected);
  });
});
