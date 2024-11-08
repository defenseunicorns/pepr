// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import * as sut from "../adjudicators";
import { Operation } from "../../enums";
import { GroupVersionKind } from "kubernetes-fluent-client";

describe("declaredUid", () => {
  const defaultAdmissionRequest = {
    uid: undefined,
    kind: { kind: "a-kind", group: "a-group" },
    group: "a-group",
    resource: { group: "some-group", version: "some-version", resource: "some-resource" },
    operation: Operation.CONNECT,
    name: "some-name",
    userInfo: {},
    object: {},
  };
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ uid: null }, ""],
    [{ uid: "uid" }, "uid"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = {
      ...defaultAdmissionRequest,
      uid: ("uid" in given ? given.uid : (undefined as unknown as string)) as string,
    };

    const result = sut.declaredUid(request);

    expect(result).toEqual(expected);
  });
});

describe("declaredKind", () => {
  const defaultAdmissionRequest = {
    uid: "some-uid",
    kind: undefined,
    group: "a-group",
    resource: { group: "some-group", version: "some-version", resource: "some-resource" },
    operation: Operation.CONNECT,
    name: "some-name",
    userInfo: {},
    object: {},
  };
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { kind: null } }, ""],
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = {
      ...defaultAdmissionRequest,
      kind: ("kind" in given ? given.kind : (undefined as unknown as string)) as GroupVersionKind,
    };

    const result = sut.declaredKind(request);

    expect(result).toEqual(expected);
  });
});

describe("declaredVersion", () => {
  const defaultAdmissionRequest = {
    uid: "some-uid",
    kind: undefined,
    group: "a-group",
    resource: { group: "some-group", version: "some-version", resource: "some-resource" },
    operation: Operation.CONNECT,
    name: "some-name",
    userInfo: {},
    object: {},
  };
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { version: null } }, ""],
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = {
      ...defaultAdmissionRequest,
      kind: ("kind" in given ? given.kind : (undefined as unknown as string)) as GroupVersionKind,
    };

    const result = sut.declaredVersion(request);

    expect(result).toEqual(expected);
  });
});

describe("declaredGroup", () => {
  const defaultAdmissionRequest = {
    uid: "some-uid",
    kind: undefined,
    group: "a-group",
    resource: { group: "some-group", version: "some-version", resource: "some-resource" },
    operation: Operation.CONNECT,
    name: "some-name",
    userInfo: {},
    object: {},
  };
  //[ AdmissionRequest, result ]
  it.each([
    [{}, ""],
    [{ kind: null }, ""],
    [{ kind: {} }, ""],
    [{ kind: { group: null } }, ""],
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = {
      ...defaultAdmissionRequest,
      kind: ("kind" in given ? given.kind : (undefined as unknown as string)) as GroupVersionKind,
    };

    const result = sut.declaredGroup(request);

    expect(result).toEqual(expected);
  });
});

describe("declaredOperation", () => {
  const defaultAdmissionRequest = {
    uid: "some-uid",
    kind: { kind: "a-kind", group: "a-group" },
    resource: { group: "some-group", version: "some-version", resource: "some-resource" },
    operation: undefined,
    name: "some-name",
    userInfo: {},
    object: {},
  };
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
    const request = {
      ...defaultAdmissionRequest,
      operation: ("operation" in given ? given.operation : (undefined as unknown as string)) as Operation,
    };

    const result = sut.declaredOperation(request);

    expect(result).toEqual(expected);
  });
});
