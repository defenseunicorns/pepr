// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import {
  bindsToKind,
  bindsToNamespace,
  carriesIgnoredNamespace,
  misboundDeleteWithDeletionTimestamp,
  misboundNamespace,
  missingCarriableNamespace,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./postCollection";
import { operationMatchesEvent } from "./mismatch";
import { KubernetesObject } from "kubernetes-fluent-client";
import { Binding, DeepPartial } from "../../types";
import { Event, Operation } from "../../enums";
import { defaultBinding, defaultFilters } from "./defaultTestObjects";

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

    const result = bindsToKind(binding, kind);

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

    const result = missingCarriableNamespace(nss, object);

    expect(result).toBe(expected);
  });
});

describe("uncarryableNamespace", () => {
  //[ capa ns's, KubernetesObject, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "namespace" } }, false],

    [["namespace"], { kind: "Namespace", metadata: { name: "namespace" } }, false],
    [["namespace"], { kind: "Namespace", metadata: { name: "monitoring" } }, true],

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

    const result = uncarryableNamespace(nss, object);

    expect(result).toBe(expected);
  });
});

describe("carriesIgnoredNamespace", () => {
  //[ ignored ns's, KubernetesObject, result ]
  it.each([
    [[], {}, false],
    [[], { metadata: { namespace: "whatever" } }, false],

    [["ignored"], { kind: "Namespace", metadata: { name: "ignored" } }, true],
    [["ignored"], { kind: "Namespace", metadata: { name: "monitoring" } }, false],

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

    const result = carriesIgnoredNamespace(nss, object);

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

    const result = unbindableNamespaces(nss, binding);

    expect(result).toBe(expected);
  });
});

describe("operationMatchesEvent", () => {
  //[ Operation, Event, result ]
  it.each([
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
    const result = operationMatchesEvent(op, evt);

    expect(result).toEqual(expected);
  });
});

describe("bindsToNamespace", () => {
  //[ Binding, result ]
  it.each([
    [{ kind: { kind: "" } }, false],
    [{ kind: { kind: "Namespace" } }, true],
  ])("given binding %j returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
      },
      kind: { kind: given.kind.kind, group: defaultBinding.kind.group },
    };

    const result = bindsToNamespace(binding);

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
    const binding: Binding = {
      ...defaultBinding,
      filters: {
        ...defaultFilters,
        namespaces: given.filters.namespaces,
      },
      kind: { kind: given.kind.kind, group: defaultBinding.kind.group },
    };

    const result = misboundNamespace(binding);

    expect(result).toBe(expected);
  });
});

describe("misboundDeleteWithDeletionTimestamp", () => {
  //[ Binding, result ]
  it.each([
    [{ event: Event.DELETE, filters: { deletionTimestamp: false } }, false],
    [{ event: Event.DELETE, filters: { deletionTimestamp: true } }, true],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      filters: { ...defaultFilters, deletionTimestamp: given.filters.deletionTimestamp },
      event: given.event,
    };

    const result = misboundDeleteWithDeletionTimestamp(binding);

    expect(result).toEqual(expected);
  });
});
describe("when filters are not set", () => {
  it.each([
    [{ event: Event.CREATE }, false],
    [{ event: Event.CREATE_OR_UPDATE }, false],
    [{ event: Event.UPDATE }, false],
    [{ event: Event.DELETE }, false],
  ])("given %j, returns %s", (given, expected) => {
    const binding: Binding = {
      ...defaultBinding,
      event: given.event,
    };

    const result = misboundDeleteWithDeletionTimestamp(binding);

    expect(result).toEqual(expected);
  });
});
