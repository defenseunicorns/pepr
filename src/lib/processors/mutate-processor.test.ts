// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { clone } from "ramda";
import { ModuleConfig } from "../core/module";
import { PeprMutateRequest } from "../mutate-request";
import * as sut from "./mutate-processor";
import { AdmissionRequest, Binding, MutateAction } from "../types";
import { Event, Operation } from "../enums";
import { convertFromBase64Map, convertToBase64Map } from "../utils";
import { GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { MutateResponse } from "../k8s";
import { Errors } from "../errors";

jest.mock("../utils");
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

describe("decodeData", () => {
  const skips = ["convert", "From", "Base64", "Map"];

  beforeEach(() => {
    mockConvertFromBase64Map.mockImplementation(() => skips);
  });

  it("returns skips if required & given a Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const { skipped, wrapped } = sut.decodeData(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertFromBase64Map.mock.calls[0].at(0)).toBe(testPeprMutateRequest.Raw);
    expect(skipped).toBe(skips);
    expect(wrapped).toBe(testPeprMutateRequest);
  });

  it("returns no skips when given a non-Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "NotASecret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const { skipped, wrapped } = sut.decodeData(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(0);
    expect(skipped).toEqual([]);
    expect(wrapped).toBe(testPeprMutateRequest);
  });
});

describe("reencodeData", () => {
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

    const transformed = sut.reencodeData(testPeprMutateRequest, skipped);

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

    const transformed = sut.reencodeData(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertToBase64Map.mock.calls[0].at(0)).toEqual(testPeprMutateRequest.Raw);
    expect(mockConvertToBase64Map.mock.calls[0].at(1)).toBe(skipped);
    expect(transformed).toEqual(testPeprMutateRequest.Raw);
  });
});

const defaultBinding: Binding = {
  event: Event.CREATE,
  model: {} as GenericClass,
  kind: {
    kind: "kind",
    group: "group",
    version: "version",
  },
  filters: {
    annotations: {},
    deletionTimestamp: false,
    labels: {},
    name: "",
    namespaces: [],
    regexName: "",
    regexNamespaces: [],
  },
  mutateCallback: jest.fn() as jest.Mocked<MutateAction<GenericClass, KubernetesObject>>,
};

const defaultBindable: sut.Bindable = {
  req: defaultAdmissionRequest,
  config: defaultModuleConfig,
  name: "test-name",
  namespaces: [],
  binding: defaultBinding,
  actMeta: {},
};

const defaultMutateResponse: MutateResponse = {
  uid: "default-uid",
  allowed: true,
};

describe("processRequest", () => {
  it("adds a status annotation on success", async () => {
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);
    const annote = `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`;

    const result = await sut.processRequest(defaultBindable, testPeprMutateRequest, testMutateResponse);

    expect(result).toEqual({ wrapped: testPeprMutateRequest, response: testMutateResponse });
    expect(result.wrapped.Raw.metadata?.annotations).toBeDefined();
    expect(result.wrapped.Raw.metadata!.annotations![annote]).toBe("succeeded");

    expect(result.response.warnings).toBeUndefined();
    expect(result.response.result).toBeUndefined();
    expect(result.response.auditAnnotations).toBeUndefined();
  });

  it("adds a status annotation, warning, and result on failure when Errors.reject", async () => {
    const mutateCallback = (jest.fn() as jest.Mocked<MutateAction<GenericClass, KubernetesObject>>).mockImplementation(
      () => {
        throw "oof";
      },
    );
    const testBinding = { ...clone(defaultBinding), mutateCallback };
    const testBindable = { ...clone(defaultBindable), binding: testBinding };
    testBindable.config.onError = Errors.reject;
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);
    const annote = `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`;

    const result = await sut.processRequest(testBindable, testPeprMutateRequest, testMutateResponse);

    expect(result).toEqual({ wrapped: testPeprMutateRequest, response: testMutateResponse });
    expect(result.wrapped.Raw.metadata?.annotations).toBeDefined();
    expect(result.wrapped.Raw.metadata!.annotations![annote]).toBe("warning");

    expect(result.response.warnings).toHaveLength(1);
    expect(result.response.warnings![0]).toBe("Action failed: An error occurred with the mutate action.");
    expect(result.response.result).toBe("Pepr module configured to reject on error");
    expect(result.response.auditAnnotations).toBeUndefined();
  });

  it("adds a status annotation, warning, and auditAnnotation on failure when Errors.audit", async () => {
    const mutateCallback = (jest.fn() as jest.Mocked<MutateAction<GenericClass, KubernetesObject>>).mockImplementation(
      () => {
        throw "oof";
      },
    );
    const testBinding = { ...clone(defaultBinding), mutateCallback };
    const testBindable = { ...clone(defaultBindable), binding: testBinding };
    testBindable.config.onError = Errors.audit;
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);
    const annote = `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`;

    const result = await sut.processRequest(testBindable, testPeprMutateRequest, testMutateResponse);

    expect(result).toEqual({ wrapped: testPeprMutateRequest, response: testMutateResponse });
    expect(result.wrapped.Raw.metadata?.annotations).toBeDefined();
    expect(result.wrapped.Raw.metadata!.annotations![annote]).toBe("warning");

    expect(result.response.warnings).toHaveLength(1);
    expect(result.response.warnings![0]).toBe("Action failed: An error occurred with the mutate action.");
    expect(result.response.result).toBeUndefined();
    expect(result.response.auditAnnotations).toBeDefined();

    const auditAnnotes = Object.entries(result.response.auditAnnotations!);
    expect(auditAnnotes).toHaveLength(1);

    const [key, val] = auditAnnotes[0];
    expect(Date.now() - parseInt(key)).toBeLessThan(5);
    expect(val).toBe("Action failed: An error occurred with the mutate action.");
  });
});
