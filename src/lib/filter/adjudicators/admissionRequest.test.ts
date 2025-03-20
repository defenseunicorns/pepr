// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { Operation } from "../../enums";
import { defaultAdmissionRequest } from "./defaultTestObjects";
import {
  declaredUid,
  declaredKind,
  declaredVersion,
  declaredGroup,
  declaredOperation,
} from "./admissionRequest";
import { AdmissionRequest } from "../../common-types";

describe("declaredUid", () => {
  //[ AdmissionRequest, result ]
  it.each([[{ uid: "uid" }, "uid"]])("given %j, returns '%s'", (given, expected) => {
    const admissionRequest: AdmissionRequest = {
      ...defaultAdmissionRequest,
      uid: given.uid,
    };

    const result = declaredUid(admissionRequest);

    expect(result).toEqual(expected);
  });
});

describe("declaredKind", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{ kind: { kind: "" } }, ""],
    [{ kind: { kind: "kind" } }, "kind"],
  ])("given %j, returns '%s'", (given, expected) => {
    const admissionRequest: AdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: { kind: given.kind.kind, group: defaultAdmissionRequest.kind.group },
    };

    const result = declaredKind(admissionRequest);

    expect(result).toEqual(expected);
  });
});

describe("declaredVersion", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{ kind: {} }, ""],
    [{ kind: { version: "" } }, ""],
    [{ kind: { version: "version" } }, "version"],
  ])("given %j, returns '%s'", (given, expected) => {
    const admissionRequest: AdmissionRequest = {
      ...defaultAdmissionRequest,
      kind:
        "version" in given.kind
          ? { ...defaultAdmissionRequest.kind, version: given.kind.version }
          : defaultAdmissionRequest.kind,
    };

    const result = declaredVersion(admissionRequest);

    expect(result).toEqual(expected);
  });
});

describe("declaredGroup", () => {
  //[ AdmissionRequest, result ]
  it.each([
    [{ kind: { group: "" } }, ""],
    [{ kind: { group: "group" } }, "group"],
  ])("given %j, returns '%s'", (given, expected) => {
    const admissionRequest: AdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: { ...defaultAdmissionRequest.kind, group: given.kind.group },
    };

    const result = declaredGroup(admissionRequest);

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
    [{ operation: Operation.CONNECT }, Operation.CONNECT],
    [{ operation: Operation.CREATE }, Operation.CREATE],
    [{ operation: Operation.UPDATE }, Operation.UPDATE],
    [{ operation: Operation.DELETE }, Operation.DELETE],
  ])("given %j, returns '%s'", (given, expected) => {
    const request = {
      ...defaultAdmissionRequest,
      operation: given.operation,
    };

    const result = declaredOperation(request);

    expect(result).toEqual(expected);
  });
});
