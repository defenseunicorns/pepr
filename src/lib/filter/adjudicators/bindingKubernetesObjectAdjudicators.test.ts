/* eslint-disable max-statements */
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { Binding, DeepPartial } from "../../types";
import { Event } from "../../enums";
import {
  mismatchedName,
  mismatchedDeletionTimestamp,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  mismatchedAnnotations,
  mismatchedLabels,
  metasMismatch,
} from "../adjudicators";

const defaultFilters = {
  annotations: {},
  deletionTimestamp: false,
  labels: {},
  name: "",
  namespaces: [],
  regexName: "^default$",
  regexNamespaces: [],
};
const defaultBinding: Binding = {
  event: Event.ANY,
  filters: defaultFilters,
  kind: { kind: "some-kind", group: "some-group" },
  model: kind.Pod,
  isFinalize: false,
  isMutate: false,
  isQueue: false,
  isValidate: false,
  isWatch: false,
};

const defaultKubernetesObject: KubernetesObject = {
  apiVersion: "some-version",
  kind: "some-kind",
  metadata: { name: "some-name" },
};

describe("mismatchedName", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    [{}, {}, false],
    [{}, { metadata: { name: "name" } }, false],
    [{ filters: { name: "name" } }, {}, true],
    [{ filters: { name: "name" } }, { metadata: { name: "name" } }, false],
  ])("given binding %j and object %j, returns %s", (bnd, obj, expected) => {
    const binding = {
      ...defaultBinding,
      filters: "filters" in bnd ? { ...defaultFilters, name: bnd.filters.name } : { ...defaultFilters },
    };
    const object = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };

    const result = mismatchedName(binding, object);

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

    const result = mismatchedDeletionTimestamp(binding, object);

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

describe("mismatchedNamespaceRegex", () => {
  //[ Binding, KubernetesObject, result ]
  it.each([
    // [{}, {}, false],
    // [{}, { metadata: { namespace: "namespace" } }, false],
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
    const binding = { ...defaultBinding, filters: { ...defaultFilters, regexNamespace: bnd.filters.regexNamespaces } };
    const object = {
      ...defaultKubernetesObject,
      metadata: "metadata" in obj ? obj.metadata : defaultKubernetesObject.metadata,
    };

    const result = mismatchedNamespaceRegex(binding, object);

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
