// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { KubernetesObject } from "kubernetes-fluent-client";
import { DeepPartial, ValidateActionResponse } from "../../types";
import { Event } from "../../enums";
import {
  bindsToNamespace,
  carriedAnnotations,
  carriedLabels,
  carriedName,
  carriedNamespace,
  carriesAnnotations,
  carriesLabels,
  carriesName,
  carriesNamespace,
  definedAnnotations,
  definedCallback,
  definedCallbackName,
  definedCategory,
  definedEvent,
  definedGroup,
  definedKind,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaceRegexes,
  definedNamespaces,
  definedVersion,
  definesAnnotations,
  definesDelete,
  definesDeletionTimestamp,
  definesGroup,
  definesKind,
  definesLabels,
  definesName,
  definesNameRegex,
  definesNamespaceRegexes,
  definesNamespaces,
  definesVersion,
  ignoresDeletionTimestamp,
  ignoresName,
  misboundDeleteWithDeletionTimestamp,
  misboundNamespace,
  missingName,
} from "../adjudicators";
import { defaultBinding, defaultFilters, defaultKubernetesObject } from "./defaultTestObjects";

describe("definesDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{ filters: { deletionTimestamp: false } }, false],
    [{ filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        deletionTimestamp: given.filters.deletionTimestamp,
      },
    };

    const result = definesDeletionTimestamp(binding);

    expect(result).toBe(expected);
  });
});

describe("ignoresDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{ filters: { deletionTimestamp: false } }, true],
    [{ filters: { deletionTimestamp: true } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        deletionTimestamp: given.filters.deletionTimestamp,
      },
    };

    const result = ignoresDeletionTimestamp(binding);

    expect(result).toBe(expected);
  });
});

describe("definedName", () => {
  //[ Binding, result ]
  it.each([[{ filters: { name: "name" } }, "name"]])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        name: given.filters.name,
      },
    };

    const result = definedName(binding);

    expect(result).toBe(expected);
  });
});

describe("definesName", () => {
  //[ Binding, result ]
  it.each([[{ filters: { name: "name" } }, true]])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        name: given.filters.name,
      },
    };

    const result = definesName(binding);

    expect(result).toBe(expected);
  });
});

describe("ignoresName", () => {
  //[ Binding, result ]
  it.each([
    // [{}, true],
    // [{ filters: {} }, true],
    // [{ filters: { name: null } }, true],
    [{ filters: { name: "name" } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        name: given.filters.name,
      },
    };

    const result = ignoresName(binding);

    expect(result).toBe(expected);
  });
});

describe("definedNameRegex", () => {
  //[ Binding, result ]
  it.each([
    // [{}, ""],
    // [{ filters: {} }, ""],
    // [{ filters: { regexName: null } }, ""],
    [{ filters: { regexName: "n.me" } }, "n.me"], // TODO: should this be a regex object?
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        regexName: given.filters.regexName,
      },
    };

    const result = definedNameRegex(binding);

    expect(result).toBe(expected);
  });
});

describe("definesNameRegex", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ filters: {} }, false],
    // [{ filters: { regexName: null } }, false],
    [{ filters: { regexName: "n.me" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        regexName: given.filters.regexName,
      },
    };

    const result = definesNameRegex(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedName", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, ""],
    // [{ metadata: {} }, ""],
    // [{ metadata: { name: null } }, ""],
    [{ metadata: { name: "name" } }, "name"],
  ])("given %j, returns '%s'", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { name: given.metadata.name },
    };

    const result = carriedName(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("carriesName", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, false],
    // [{ metadata: {} }, false],
    // [{ metadata: { name: null } }, false],
    [{ metadata: { name: "name" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { name: given.metadata.name },
    };

    const result = carriesName(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("missingName", () => {
  //[ Binding, result ]
  it.each([
    // [{}, true],
    // [{ metadata: {} }, true],
    // [{ metadata: { name: null } }, true],
    [{ metadata: { name: "name" } }, false],
  ])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { name: given.metadata.name },
    };

    const result = missingName(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("bindsToNamespace", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ kind: {} }, false],
    [{ kind: { kind: null } }, false],
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "Namespace" } }, true],
  ])("given binding %j returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
      },
      kind: { kind: given.kind.kind },
    };

    const result = bindsToNamespace(binding);

    expect(result).toBe(expected);
  });
});

describe("definedNamespaces", () => {
  //[ Binding, result ]
  it.each([
    // [{}, []],
    // [{ filters: {} }, []],
    [{ filters: { namespaces: null } }, []],
    [{ filters: { namespaces: [] } }, []],
    [{ filters: { namespaces: ["namespace"] } }, ["namespace"]],
    [{ filters: { namespaces: ["name", "space"] } }, ["name", "space"]],
  ])("given %j, returns %j", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        namespaces: given.filters.namespaces,
      },
    };

    const result = definedNamespaces(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesNamespaces", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ filters: {} }, false],
    [{ filters: { namespaces: null } }, false],
    [{ filters: { namespaces: [] } }, false],
    [{ filters: { namespaces: ["namespace"] } }, true],
    [{ filters: { namespaces: ["name", "space"] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        namespaces: given.filters.namespaces,
      },
    };

    const result = definesNamespaces(binding);

    expect(result).toBe(expected);
  });
});

describe("definedNamespaceRegexes", () => {
  //[ Binding, result ]
  it.each([
    // [{}, []],
    // [{ filters: {} }, []],
    // [{ filters: { regexNamespaces: null } }, []],
    [{ filters: { regexNamespaces: [] } }, []],
    [{ filters: { regexNamespaces: [/n.mesp.ce/] } }, ["n.mesp.ce"]],
    [{ filters: { regexNamespaces: [/n.me/, /sp.ce/] } }, ["n.me", "sp.ce"]],
  ])("given %j, returns %j", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        regexNamespaces: given.filters.regexNamespaces,
      },
    };

    const result = definedNamespaceRegexes(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesNamespaceRegexes", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ filters: {} }, false],
    // [{ filters: { regexNamespaces: null } }, false],
    [{ filters: { regexNamespaces: [] } }, false],
    [{ filters: { regexNamespaces: [/n.mesp.ce/] } }, true],
    [{ filters: { regexNamespaces: [/n.me/, /sp.ce/] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        regexNamespaces: given.filters.regexNamespaces,
      },
    };

    const result = definesNamespaceRegexes(binding);

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
    const binding = given as DeepPartial<KubernetesObject>;

    const result = carriedNamespace(binding);

    expect(result).toEqual(expected);
  });
});

describe("carriesNamespace", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, false],
    // [{ metadata: {} }, false],
    // [{ metadata: { namespace: null } }, false],
    [{ metadata: { namespace: "" } }, false],
    [{ metadata: { namespace: "namespace" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { namespace: given.metadata.namespace },
    };

    const result = carriesNamespace(kubernetesObject);

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
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        namespaces: given.filters.namespaces,
      },
      kind: given.kind,
    };

    const result = misboundNamespace(binding);

    expect(result).toBe(expected);
  });
});

describe("definedAnnotations", () => {
  //[ Binding, result ]
  it.each([
    // [{}, {}],
    // [{ filters: {} }, {}],
    // [{ filters: { annotations: null } }, {}],
    [{ filters: { annotations: {} } }, {}],
    [{ filters: { annotations: { annotation: "" } } }, { annotation: "" }],
    [{ filters: { annotations: { anno: "tation" } } }, { anno: "tation" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        annotations: given.filters.annotations,
      },
    };

    const result = definedAnnotations(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesAnnotations", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ filters: {} }, false],
    // [{ filters: { annotations: null } }, false],
    [{ filters: { annotations: {} } }, false],
    [{ filters: { annotations: { annotation: "" } } }, true],
    [{ filters: { annotations: { anno: "tation" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        annotations: given.filters.annotations,
      },
    };

    const result = definesAnnotations(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedAnnotations", () => {
  //[ KuberneteObject, result ]
  it.each([
    // [{}, {}],
    // [{ metadata: {} }, {}],
    // [{ metadata: { annotations: null } }, {}],
    [{ metadata: { annotations: {} } }, {}],
    [{ metadata: { annotations: { annotation: "" } } }, { annotation: "" }],
    [{ metadata: { annotations: { anno: "tation" } } }, { anno: "tation" }],
  ])("given %j, returns %j", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { annotations: given.metadata.annotations },
    };

    const result = carriedAnnotations(kubernetesObject);

    expect(result).toEqual(expected);
  });
});

describe("carriesAnnotations", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, false],
    // [{ metadata: {} }, false],
    // [{ metadata: { annotations: null } }, false],
    [{ metadata: { annotations: {} } }, false],
    [{ metadata: { annotations: { annotation: "" } } }, true],
    [{ metadata: { annotations: { anno: "tation" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { annotations: given.metadata.annotations },
    };

    const result = carriesAnnotations(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("definedLabels", () => {
  //[ Binding, result ]
  it.each([
    // [{}, {}],
    // [{ filters: {} }, {}],
    // [{ filters: { labels: null } }, {}],
    [{ filters: { labels: {} } }, {}],
    [{ filters: { labels: { label: "" } } }, { label: "" }],
    [{ filters: { labels: { lab: "el" } } }, { lab: "el" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        labels: given.filters.labels,
      },
    };

    const result = definedLabels(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesLabels", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ filters: {} }, false],
    // [{ filters: { labels: null } }, false],
    [{ filters: { labels: {} } }, false],
    [{ filters: { labels: { label: "" } } }, true],
    [{ filters: { labels: { lab: "el" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        labels: given.filters.labels,
      },
    };

    const result = definesLabels(binding);

    expect(result).toBe(expected);
  });
});

describe("carriedLabels", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, {}],
    // [{ metadata: {} }, {}],
    // [{ metadata: { labels: null } }, {}],
    [{ metadata: { labels: {} } }, {}],
    [{ metadata: { labels: { label: "" } } }, { label: "" }],
    [{ metadata: { labels: { lab: "el" } } }, { lab: "el" }],
  ])("given %j, returns %j", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { labels: given.metadata.labels },
    };

    const result = carriedLabels(kubernetesObject);

    expect(result).toEqual(expected);
  });
});

describe("carriesLabels", () => {
  //[ KubernetesObject, result ]
  it.each([
    // [{}, false],
    // [{ metadata: {} }, false],
    // [{ metadata: { labels: null } }, false],
    [{ metadata: { labels: {} } }, false],
    [{ metadata: { labels: { label: "" } } }, true],
    [{ metadata: { labels: { lab: "el" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { labels: given.metadata.labels },
    };

    const result = carriesLabels(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("definedEvent", () => {
  //[ Binding, result ]
  it.each([
    // [{}, ""],
    // [{ event: "" }, ""],
    // [{ event: "nonsense" }, "nonsense"],
    [{ event: Event.CREATE }, Event.CREATE],
    [{ event: Event.CREATE_OR_UPDATE }, Event.CREATE_OR_UPDATE],
    [{ event: Event.UPDATE }, Event.UPDATE],
    [{ event: Event.DELETE }, Event.DELETE],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      event: given.event,
    };

    const result = definedEvent(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesDelete", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ event: "" }, false],
    // [{ event: "nonsense" }, false],
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      event: given.event,
    };

    const result = definesDelete(binding);

    expect(result).toEqual(expected);
  });
});

describe("misboundDeleteWithDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{ event: Event.DELETE, filters: {} }, false],
    [{ event: Event.DELETE, filters: { deletionTimestamp: false } }, false],
    [{ event: Event.DELETE, filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      filters:
        "deletionTimestamp" in given.filters
          ? { ...defaultFilters, deletionTimestamp: given.filters.deletionTimestamp }
          : defaultFilters,
      event: given.event,
    };

    const result = misboundDeleteWithDeletionTimestamp(binding);

    expect(result).toEqual(expected);
  });
});
describe("when filters are not set", () => {
  it.each([
    // [{}, false],
    // [{ event: "" }, false],
    // [{ event: "nonsense" }, false],
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      event: given.event,
    };

    const result = misboundDeleteWithDeletionTimestamp(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedGroup", () => {
  //[ Binding, result ]
  it.each([
    // [{}, ""],
    // [{ kind: null }, ""],
    // [{ kind: {} }, ""],
    [{ kind: { group: null } }, ""],
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { group: given.kind.group },
    };

    const result = definedGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesGroup", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ kind: null }, false],
    // [{ kind: {} }, false],
    [{ kind: { group: null } }, false],
    [{ kind: { group: "" } }, false],
    [{ kind: { group: "group" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { group: given.kind.group },
    };

    const result = definesGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedVersion", () => {
  //[ Binding, result ]
  it.each([
    // [{}, ""],
    // [{ kind: null }, ""],
    // [{ kind: {} }, ""],
    // [{ kind: { version: null } }, ""],
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { kind: "some-kind", group: "some-group", version: given.kind.version },
    };

    const result = definedVersion(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesVersion", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ kind: null }, false],
    // [{ kind: {} }, false],
    // [{ kind: { version: null } }, false],
    [{ kind: { version: "" } }, false],
    [{ kind: { version: "version" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { kind: "some-kind", group: "some-group", version: given.kind.version },
    };

    const result = definesVersion(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedKind", () => {
  //[ Binding, result ]
  it.each([
    // [{}, ""],
    // [{ kind: null }, ""],
    // [{ kind: {} }, ""],
    [{ kind: { kind: null } }, ""],
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { kind: given.kind.kind },
    };

    const result = definedKind(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesKind", () => {
  //[ Binding, result ]
  it.each([
    // [{}, false],
    // [{ kind: null }, false],
    // [{ kind: {} }, false],
    [{ kind: { kind: null } }, false],
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "kind" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding = {
      ...defaultBinding,
      kind: { kind: given.kind.kind },
    };

    const result = definesKind(binding);

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
    const binding = {
      ...defaultBinding,
      ...given,
    };

    const result = definedCategory(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedCallback", () => {
  const validateCallback = (): ValidateActionResponse => {
    return { allowed: false };
  };
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
    const binding = {
      ...defaultBinding,
      ...given,
    };

    const result = definedCallback(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedCallbackName", () => {
  const validateCallback = (): ValidateActionResponse => {
    return { allowed: false };
  };
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
    const binding = {
      ...defaultBinding,
      ...given,
    };

    const result = definedCallbackName(binding);

    expect(result).toEqual(expected);
  });
});
