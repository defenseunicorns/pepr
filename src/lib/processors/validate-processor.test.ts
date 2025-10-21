// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GroupVersionKind, kind, KubernetesObject } from "kubernetes-fluent-client";
import { Binding, Filters } from "../types";
import { Event, Operation } from "../enums";
import { PeprValidateRequest } from "../validate-request";
import { clone } from "ramda";
import { AdmissionRequest } from "../common-types";
import {
  processRequest,
  validateProcessor,
  getIgnoreNamespaces,
  shouldSkipBinding,
} from "./validate-processor";
import { ModuleConfig } from "../types";
import { Capability } from "../core/capability";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import * as utils from "../utils";
import { shouldSkipRequest } from "../filter/filter";

vi.mock("../telemetry/logger", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../telemetry/metrics", () => ({
  metricsCollector: {
    addCounter: vi.fn(),
    incCounter: vi.fn(),
  },
  MeasureWebhookTimeout: vi.fn(),
}));

vi.mock("../telemetry/timeUtils", () => ({
  getNow: vi.fn(() => 1000),
}));

vi.mock("../filter/filter", () => ({
  shouldSkipRequest: vi.fn(),
}));

const testFilters: Filters = {
  annotations: {},
  deletionTimestamp: false,
  labels: {},
  name: "",
  namespaces: [],
  regexName: "^default$",
  regexNamespaces: [] as string[],
};

const testGroupVersionKind: GroupVersionKind = {
  kind: "some-kind",
  group: "some-group",
};

const testBinding: Binding = {
  event: Event.ANY,
  filters: testFilters,
  kind: testGroupVersionKind,
  model: kind.Pod,
  isFinalize: false,
  isMutate: false,
  isQueue: false,
  isValidate: false,
  isWatch: false,
};

export const testAdmissionRequest: AdmissionRequest = {
  uid: "some-uid",
  kind: { kind: "a-kind", group: "a-group" },
  resource: { group: "some-group", version: "some-version", resource: "some-resource" },
  operation: Operation.CONNECT,
  name: "some-name",
  userInfo: {},
  object: {},
};

export const testActionMetadata: Record<string, string> = {};

export const testPeprValidateRequest = (
  admissionRequest: AdmissionRequest,
): PeprValidateRequest<KubernetesObject> =>
  new PeprValidateRequest<KubernetesObject>(admissionRequest);

describe("when processing requests", () => {
  let binding: Binding;
  let actionMetadata: Record<string, string>;
  let peprValidateRequest: PeprValidateRequest<KubernetesObject>;

  beforeEach(() => {
    binding = clone(testBinding);
    actionMetadata = clone(testActionMetadata);
    peprValidateRequest = testPeprValidateRequest(testAdmissionRequest);
  });

  it("should respond on successful validation action", async () => {
    const cbResult = {
      allowed: true,
      statusCode: 200,
      statusMessage: "yay",
    };
    const callback = vi.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: cbResult.allowed,
      status: {
        code: cbResult.statusCode,
        message: cbResult.statusMessage,
      },
    });
  });

  it("should respond on unsuccessful validation action with exception", async () => {
    const callback = vi.fn().mockImplementation(() => {
      throw "oof";
    }) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: false,
      status: {
        code: 500,
        message: `Action failed with error: "oof"`,
      },
    });
  });

  it("should respond on unsuccessful validation with status code", async () => {
    const cbResult = {
      allowed: false,
      statusCode: 403,
    };
    const callback = vi.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: false,
      status: {
        code: 403,
        message: `Validation failed for ${peprValidateRequest.Request.kind.kind.toLowerCase()}/${peprValidateRequest.Request.name}`,
      },
    });
  });

  it("should respond with namespace in error message when present", async () => {
    const cbResult = {
      allowed: false,
      statusCode: 403,
    };
    const callback = vi.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const requestWithNamespace = {
      ...testAdmissionRequest,
      namespace: "test-namespace",
    };
    const peprRequestWithNamespace = testPeprValidateRequest(requestWithNamespace);

    const result = await processRequest(binding, actionMetadata, peprRequestWithNamespace);

    expect(result).toEqual({
      uid: peprRequestWithNamespace.Request.uid,
      allowed: false,
      status: {
        code: 403,
        message: `Validation failed for ${peprRequestWithNamespace.Request.kind.kind.toLowerCase()}/${peprRequestWithNamespace.Request.name} in ${peprRequestWithNamespace.Request.namespace} namespace.`,
      },
    });
  });

  it("should respond with status message when provided", async () => {
    const cbResult = {
      allowed: false,
      statusMessage: "Resource validation failed",
    };
    const callback = vi.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: false,
      status: {
        code: 400,
        message: "Resource validation failed",
      },
    });
  });

  it("should transfer warnings from callback response", async () => {
    const cbResult = {
      allowed: true,
      statusCode: 200,
      statusMessage: "Validation succeeded with warnings",
      warnings: ["Warning 1", "Warning 2"],
    };
    const callback = vi.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
    binding = { ...clone(testBinding), validateCallback: callback };

    const result = await processRequest(binding, actionMetadata, peprValidateRequest);

    expect(result).toEqual({
      uid: peprValidateRequest.Request.uid,
      allowed: true,
      status: {
        code: 200,
        message: "Validation succeeded with warnings",
      },
      warnings: ["Warning 1", "Warning 2"],
    });
  });
});

describe("when validating requests", () => {
  let config: ModuleConfig;
  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      webhookTimeout: 11,
      uuid: "some-uuid",
      alwaysIgnore: {},
    };
  });
  it("should measure if a timeout occurred based on webhookTimeout", async () => {
    const capability = new Capability({
      name: "test",
      description: "test",
    });

    const req = testAdmissionRequest;
    const reqMetadata = {};

    const spyStart = vi.spyOn(MeasureWebhookTimeout.prototype, "start");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyStart).toHaveBeenCalledWith(config.webhookTimeout);
    spyStart.mockRestore();
  });

  it("should call convertFromBase64Map if the kind is a Secret", async () => {
    const capability = new Capability({
      name: "test",
      description: "test",
    });
    const testGroupVersionKind: GroupVersionKind = {
      kind: "Secret",
      version: "v1",
      group: "",
    };
    const req: AdmissionRequest = { ...testAdmissionRequest, kind: testGroupVersionKind };
    const reqMetadata = {};

    const spyConvert = vi.spyOn(utils, "convertFromBase64Map");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyConvert).toHaveBeenCalled();
    spyConvert.mockRestore();
  });

  it("should stop the timer after processing", async () => {
    const capability = new Capability({
      name: "test",
      description: "test",
    });

    const req = testAdmissionRequest;
    const reqMetadata = {};

    const spyStop = vi.spyOn(MeasureWebhookTimeout.prototype, "stop");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyStop).toHaveBeenCalled();
    spyStop.mockRestore();
  });

  it("should skip bindings that do not have validateCallback", async () => {
    config = {
      webhookTimeout: 10,
      uuid: "some-uuid",
      alwaysIgnore: {},
    };

    const capability = new Capability({
      name: "test",
      description: "test",
      bindings: [
        {
          isValidate: true,
          validateCallback: undefined,
        },
      ],
    } as unknown as Capability);

    const req = testAdmissionRequest;
    const reqMetadata = {};

    // This rule is skipped because we cannot mock this function globally as it is tested above
    const mod =
      await vi.importActual<typeof import("./validate-processor")>("./validate-processor");
    const spyProcessRequest = vi.spyOn(mod, "processRequest");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyProcessRequest).not.toHaveBeenCalled();

    spyProcessRequest.mockRestore();
  });

  it("should skip bindings if shouldSkipRequest returns a reason", async () => {
    config = {
      webhookTimeout: 10,
      uuid: "some-uuid",
      alwaysIgnore: {},
    };

    const capability = new Capability({
      name: "test",
      description: "test",
      bindings: [
        {
          isValidate: true,
          validateCallback: vi.fn(),
        },
      ],
    } as unknown as Capability);

    const req = testAdmissionRequest;
    const reqMetadata = {};

    // This rule is skipped because we cannot mock this function globally as it is tested above
    const mod =
      await vi.importActual<typeof import("./validate-processor")>("./validate-processor");
    const spyProcessRequest = vi.spyOn(mod, "processRequest");
    (shouldSkipRequest as Mock).mockReturnValue("Skip reason");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyProcessRequest).not.toHaveBeenCalled();

    spyProcessRequest.mockRestore();
  });
});

describe("helper functions", () => {
  const mockBinding = {
    isValidate: true,
    validateCallback: vi.fn(),
  } as unknown as Binding;

  const mockReq = testAdmissionRequest;

  describe("shouldSkipBinding", () => {
    it("should return true and log if shouldSkipRequest returns a reason", () => {
      (shouldSkipRequest as Mock).mockReturnValue("Skip reason");
      const result = shouldSkipBinding(mockBinding, mockReq, [], []);
      expect(result).toBe(true);
    });

    it("should return false if shouldSkipRequest returns an empty string", () => {
      (shouldSkipRequest as Mock).mockReturnValue("");
      const result = shouldSkipBinding(mockBinding, mockReq, [], []);
      expect(result).toBe(false);
    });

    it("should handle undefined namespaces gracefully", () => {
      (shouldSkipRequest as Mock).mockReturnValue("");
      const result = shouldSkipBinding(mockBinding, mockReq, undefined, []);
      expect(result).toBe(false);
    });
  });

  describe("getIgnoreNamespaces", () => {
    it("should resolve from alwaysIgnore.namespaces if provided", () => {
      const config = {
        alwaysIgnore: { namespaces: ["foo", "bar"] },
        admission: { alwaysIgnore: { namespaces: ["baz"] } },
      } as unknown as ModuleConfig;

      const result = getIgnoreNamespaces(config);
      expect(result).toEqual(expect.arrayContaining(["foo", "bar"]));
    });

    it("should fall back to admission.alwaysIgnore.namespaces", () => {
      const config = {
        admission: { alwaysIgnore: { namespaces: ["baz"] } },
      } as unknown as ModuleConfig;

      const result = getIgnoreNamespaces(config);
      expect(result).toEqual(expect.arrayContaining(["baz"]));
    });
  });
});
