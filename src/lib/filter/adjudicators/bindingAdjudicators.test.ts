// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import * as sut from "../adjudicators";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Binding, DeepPartial } from "../../types";
import { Event } from "../../enums";

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

describe("definedNameRegex", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ filters: {} }, ""],
    [{ filters: { regexName: null } }, ""],
    [{ filters: { regexName: "n.me" } }, "n.me"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definedNameRegex(binding);

    expect(result).toBe(expected);
  });
});

describe("definesNameRegex", () => {
  //[ Binding, result ]
  it.each([
    [{}, false],
    [{ filters: {} }, false],
    [{ filters: { regexName: null } }, false],
    [{ filters: { regexName: "n.me" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.definesNameRegex(binding);

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

describe("definedEvent", () => {
  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ event: "" }, ""],
    [{ event: "nonsense" }, "nonsense"],
    [{ event: Event.CREATE }, Event.CREATE],
    [{ event: Event.CREATE_OR_UPDATE }, Event.CREATE_OR_UPDATE],
    [{ event: Event.UPDATE }, Event.UPDATE],
    [{ event: Event.DELETE }, Event.DELETE],
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
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, true],
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
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, false],
    [{ event: Event.DELETE, filters: {} }, false],
    [{ event: Event.DELETE, filters: { deletionTimestamp: false } }, false],
    [{ event: Event.DELETE, filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = given as DeepPartial<Binding>;

    const result = sut.misboundDeleteWithDeletionTimestamp(binding);

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
