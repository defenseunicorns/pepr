// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "vitest";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Binding } from "../../types";
import { Event } from "../../enums";
import { defaultBinding, defaultFilters, defaultKubernetesObject } from "./defaultTestObjects";
import {
  definesDeletionTimestamp,
  ignoresDeletionTimestamp,
  definedName,
  definesName,
  ignoresName,
  definedNameRegex,
  definesNameRegex,
  definedNamespaces,
  definesNamespaces,
  definedNamespaceRegexes,
  definesNamespaceRegexes,
  definedAnnotations,
  definesAnnotations,
  definedLabels,
  definesLabels,
  definedEvent,
  definesDelete,
  definedGroup,
  definesGroup,
  definedVersion,
  definesVersion,
  definedKind,
  definesKind,
  definedCategory,
  definedCallback,
  definedCallbackName,
} from "./binding";
import {
  carriedName,
  carriesName,
  missingName,
  carriedNamespace,
  carriesNamespace,
  carriedAnnotations,
  carriesAnnotations,
  carriedLabels,
  carriesLabels,
} from "./kubernetesObject";
import { DeepPartial } from "../../common-types";
import { ValidateActionResponse } from "../../common-types";

describe("definesDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{ filters: { deletionTimestamp: false } }, false],
    [{ filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    const binding: Binding = {
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
  it.each([[{ filters: { name: "name" } }, "name"]])(
    "given %j, returns '%s'",
    (given, expected) => {
      const binding: Binding = {
        ...defaultBinding,
        filters: {
          ...defaultFilters,
          name: given.filters.name,
        },
      };

      const result = definedName(binding);

      expect(result).toBe(expected);
    },
  );
});

describe("definesName", () => {
  //[ Binding, result ]
  it.each([[{ filters: { name: "name" } }, true]])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
  it.each([[{ filters: { name: "name" } }, false]])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
  it.each([[{ filters: { regexName: "n.me" } }, "n.me"]])(
    "given %j, returns '%s'",
    (given, expected) => {
      const binding: Binding = {
        ...defaultBinding,
        filters: {
          ...defaultFilters,
          regexName: given.filters.regexName,
        },
      };

      const result = definedNameRegex(binding);

      expect(result).toBe(expected);
    },
  );
});

describe("definesNameRegex", () => {
  //[ Binding, result ]
  it.each([[{ filters: { regexName: "n.me" } }, true]])(
    "given %j, returns %s",
    (given, expected) => {
      const binding: Binding = {
        ...defaultBinding,
        filters: {
          ...defaultFilters,
          regexName: given.filters.regexName,
        },
      };

      const result = definesNameRegex(binding);

      expect(result).toBe(expected);
    },
  );
});

describe("carriedName", () => {
  //[ KubernetesObject, result ]
  it.each([[{ metadata: { name: "name" } }, "name"]])(
    "given %j, returns '%s'",
    (given, expected) => {
      const kubernetesObject = {
        ...defaultKubernetesObject,
        metadata: { name: given.metadata.name },
      };

      const result = carriedName(kubernetesObject);

      expect(result).toBe(expected);
    },
  );
});

describe("carriesName", () => {
  //[ KubernetesObject, result ]
  it.each([[{ metadata: { name: "name" } }, true]])("given %j, returns %s", (given, expected) => {
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
  it.each([[{ metadata: { name: "name" } }, false]])("given %j, returns %s", (given, expected) => {
    const kubernetesObject = {
      ...defaultKubernetesObject,
      metadata: { name: given.metadata.name },
    };

    const result = missingName(kubernetesObject);

    expect(result).toBe(expected);
  });
});

describe("definedNamespaces", () => {
  //[ Binding, result ]
  it.each([
    [{ filters: { namespaces: [] } }, []],
    [{ filters: { namespaces: ["namespace"] } }, ["namespace"]],
    [{ filters: { namespaces: ["name", "space"] } }, ["name", "space"]],
  ])("given %j, returns %j", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { namespaces: [] } }, false],
    [{ filters: { namespaces: ["namespace"] } }, true],
    [{ filters: { namespaces: ["name", "space"] } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { regexNamespaces: [] } }, []],
    [{ filters: { regexNamespaces: [new RegExp("n.mesp.ce").source] } }, ["n.mesp.ce"]],
    [
      { filters: { regexNamespaces: [new RegExp("n.me").source, new RegExp("sp.ce").source] } },
      ["n.me", "sp.ce"],
    ],
  ])("given %j, returns %j", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { regexNamespaces: [] } }, false],
    [{ filters: { regexNamespaces: [new RegExp("n.mesp.ce").source] } }, true],
    [
      { filters: { regexNamespaces: [new RegExp("n.me").source, new RegExp("sp.ce").source] } },
      true,
    ],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    const kubernetesObject = given as DeepPartial<KubernetesObject>;

    const result = carriedNamespace(kubernetesObject);

    expect(result).toEqual(expected);
  });
});

describe("carriesNamespace", () => {
  //[ KubernetesObject, result ]
  it.each([
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

describe("definedAnnotations", () => {
  //[ Binding, result ]
  it.each([
    [{ filters: { annotations: {} } }, {}],
    [{ filters: { annotations: { annotation: "" } } }, { annotation: "" }],
    [{ filters: { annotations: { anno: "tation" } } }, { anno: "tation" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { annotations: {} } }, false],
    [{ filters: { annotations: { annotation: "" } } }, true],
    [{ filters: { annotations: { anno: "tation" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { labels: {} } }, {}],
    [{ filters: { labels: { label: "" } } }, { label: "" }],
    [{ filters: { labels: { lab: "el" } } }, { lab: "el" }],
  ])("given %j, returns %j", (given, expected) => {
    const binding: Binding = {
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
    [{ filters: { labels: {} } }, false],
    [{ filters: { labels: { label: "" } } }, true],
    [{ filters: { labels: { lab: "el" } } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    [{ event: Event.CREATE }, Event.CREATE],
    [{ event: Event.CREATE_OR_UPDATE }, Event.CREATE_OR_UPDATE],
    [{ event: Event.UPDATE }, Event.UPDATE],
    [{ event: Event.DELETE }, Event.DELETE],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding: Binding = {
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
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      event: given.event,
    };

    const result = definesDelete(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedGroup", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: defaultBinding.kind.kind, group: given.kind.group },
    };

    const result = definedGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesGroup", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { group: "" } }, false],
    [{ kind: { group: "group" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: defaultBinding.kind.kind, group: given.kind.group },
    };

    const result = definesGroup(binding);

    expect(result).toEqual(expected);
  });
});

describe("definedVersion", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding: Binding = {
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
    [{ kind: { version: "" } }, false],
    [{ kind: { version: "version" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: given.kind.kind, group: defaultBinding.kind.group },
    };

    const result = definedKind(binding);

    expect(result).toEqual(expected);
  });
});

describe("definesKind", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "kind" } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      kind: { kind: given.kind.kind, group: defaultBinding.kind.group },
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
    const binding: Binding = {
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
  const mutateCallback = (): void => {};
  const watchCallback = (): void => {};
  const finalizeCallback = (): void => {};

  //[ Binding, result ]
  it.each([
    [{}, null],
    [{ isValidate: true, validateCallback }, validateCallback],
    [{ isMutate: true, mutateCallback }, mutateCallback],
    [{ isWatch: true, watchCallback }, watchCallback],
    [{ isFinalize: true, finalizeCallback }, finalizeCallback],
    [{ isFinalize: true, isValidate: true, finalizeCallback, validateCallback }, finalizeCallback], // Finalize > Validate
    [{ isFinalize: true, isWatch: true, finalizeCallback, watchCallback }, finalizeCallback], // Finalize > Watch
    [
      {
        isFinalize: true,
        isMutate: true,
        isWatch: true,
        finalizeCallback,
        mutateCallback,
        watchCallback,
      },
      finalizeCallback,
    ], // Finalize > Mutate > Watch
    [{ isValidate: true, isMutate: true, validateCallback, mutateCallback }, mutateCallback], // Mutate > Validate
    [{ isWatch: true, isMutate: true, watchCallback, mutateCallback }, watchCallback], // Watch > Mutate
    [{ isMutate: true, isFinalize: true, mutateCallback, finalizeCallback }, finalizeCallback], // Finalize > Mutate
    [
      {
        isMutate: true,
        isWatch: true,
        isFinalize: true,
        mutateCallback,
        watchCallback,
        finalizeCallback,
      },
      finalizeCallback,
    ], // Finalize > Watch > Mutate
    [
      {
        isValidate: true,
        isMutate: true,
        isFinalize: true,
        validateCallback,
        mutateCallback,
        finalizeCallback,
      },
      finalizeCallback,
    ], // Finalize > Mutate > Validate
    [
      {
        isValidate: true,
        isMutate: true,
        isWatch: true,
        validateCallback,
        mutateCallback,
        watchCallback,
      },
      watchCallback,
    ], // Watch > Mutate > Validate
    [{ isValidate: true, isWatch: true, validateCallback, watchCallback }, watchCallback], // Watch > Validate
    [
      {
        isValidate: true,
        isMutate: true,
        isWatch: true,
        isFinalize: true,
        validateCallback,
        mutateCallback,
        watchCallback,
        finalizeCallback,
      },
      finalizeCallback,
    ], // Finalize > Watch > Mutate > Validate
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
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
  const mutateCallback = (): void => {};
  const watchCallback = (): void => {};
  const finalizeCallback = (): void => {};

  //[ Binding, result ]
  it.each([
    [{}, ""],
    [{ isValidate: true, validateCallback }, "validateCallback"],
    [{ isMutate: true, mutateCallback }, "mutateCallback"],
    [{ isWatch: true, watchCallback }, "watchCallback"],
    [{ isFinalize: true, finalizeCallback }, "finalizeCallback"],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      ...given,
    };

    const result = definedCallbackName(binding);

    expect(result).toEqual(expected);
  });
});
