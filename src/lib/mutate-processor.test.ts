// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { clone } from "ramda";
import { ModuleConfig } from "./module";
import { PeprMutateRequest } from "./mutate-request";
import * as sut from "./mutate-processor";
import { AdmissionRequest } from "./types";
import { Operation } from "./enums";
import { convertFromBase64Map, convertToBase64Map } from "./utils";

jest.mock("./utils");
const mockConvertFromBase64Map = jest.mocked(convertFromBase64Map);
const mockConvertToBase64Map = jest.mocked(convertToBase64Map);

const defaultModuleConfig: ModuleConfig = {
  uuid: "test-uuid",
  alwaysIgnore: {},
};

const defaultAdmissionRequest: AdmissionRequest = {
  uid: "uid",
  kind: {
    kind: "kind",
    group: "group",
    version: "version",
  },
  resource: {
    group: "group",
    version: "version",
    resource: "resource",
  },
  name: "",
  object: {
    metadata: {
      name: "create-me",
    },
  },
  operation: Operation.CREATE,
  userInfo: {},
};

const defaultPeprMutateRequest = (admissionRequest = defaultAdmissionRequest) =>
  new PeprMutateRequest(admissionRequest);

beforeEach(() => {
  jest.resetAllMocks();
});

describe("updateStatus", () => {
  describe("when given non-delete request", () => {
    it("adds status annotation to to-be-admitted resource", () => {
      const name = "capa";
      const status = "test-status";
      const annote = `${defaultModuleConfig.uuid}.pepr.dev/${name}`;

      const result = sut.updateStatus(defaultModuleConfig, name, defaultPeprMutateRequest(), status);

      expect(result.HasAnnotation(annote)).toBe(true);
      expect(result.Raw.metadata?.annotations?.[annote]).toBe(status);
    });
  });

  describe("when given delete request", () => {
    it("does not add status annotation to to-be-admitted resource", () => {
      const testAdmissionRequest = {
        ...clone(defaultAdmissionRequest),
        operation: Operation.DELETE,
        oldObject: {},
      };
      const name = "capa";
      const annote = `${defaultModuleConfig.uuid}.pepr.dev/${name}`;

      const result = sut.updateStatus(
        defaultModuleConfig,
        name,
        defaultPeprMutateRequest(testAdmissionRequest),
        "test-status",
      );

      expect(result.HasAnnotation(annote)).toBe(false);
    });
  });
});

describe("logMutateErrorMessage", () => {
  it.each([
    // error msg, result string
    ["oof", "oof"],
    ["", "An error occurred with the mutate action."],
    ["[object Object]", "An error occurred with the mutate action."],
  ])("given error '%s', returns '%s'", (err, res) => {
    const result = sut.logMutateErrorMessage(new Error(err));
    expect(result).toBe(res);
  });
});

describe("skipDecode", () => {
  const skips = ["convert", "From", "Base64", "Map"];

  beforeEach(() => {
    mockConvertFromBase64Map.mockImplementation(() => skips);
  });

  it("returns skipped content with given a Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const skipped = sut.skipDecode(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertFromBase64Map.mock.calls[0].at(0)).toBe(testPeprMutateRequest.Raw);
    expect(skipped).toBe(skips);
  });

  it("returns nothing when given a non-Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "NotASecret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const skipped = sut.skipDecode(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(0);
    expect(skipped).toEqual([]);
  });
});

describe("unskipRecode", () => {
  it("returns unchanged content when given non-secret", () => {
    const skipped = ["convert", "To", "Base64", "Map"];
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "NotASecret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const transformed = sut.unskipRecode(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(0);
    expect(transformed).toEqual(testAdmissionRequest.object);
  });

  it("returns unchanged content when given a secret but no skips", () => {
    const skipped: string[] = [];
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const transformed = sut.unskipRecode(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(0);
    expect(transformed).toEqual(testAdmissionRequest.object);
  });

  it("returns modified content when given a secret and skips", () => {
    const skipped = ["convert", "To", "Base64", "Map"];
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const transformed = sut.unskipRecode(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertToBase64Map.mock.calls[0].at(0)).toEqual(testPeprMutateRequest.Raw);
    expect(mockConvertToBase64Map.mock.calls[0].at(1)).toBe(skipped);
    expect(transformed).toEqual(testPeprMutateRequest.Raw);
  });
});
