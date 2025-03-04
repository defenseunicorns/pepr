// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GroupVersionKind, kind, KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding, Filters } from "../types";
import { Event, Operation } from "../enums";
import { PeprValidateRequest } from "../validate-request";
import { clone } from "ramda";
import { processRequest, validateProcessor } from "./validate-processor";
import { ModuleConfig } from "../types";
import { Capability } from "../core/capability";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import * as utils from "../utils";
import { shouldSkipRequest } from "../filter/filter";

jest.mock("../telemetry/logger", () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../telemetry/metrics", () => ({
  metricsCollector: {
    addCounter: jest.fn(),
    incCounter: jest.fn(),
  },
  MeasureWebhookTimeout: jest.fn(),
}));

jest.mock("../telemetry/timeUtils", () => ({
  getNow: jest.fn(() => 1000),
}));

jest.mock("../filter/filter", () => ({
  shouldSkipRequest: jest.fn(),
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

export const testPeprValidateRequest = (admissionRequest: AdmissionRequest) =>
  new PeprValidateRequest<KubernetesObject>(admissionRequest);

describe("processRequest", () => {
  let binding: Binding;
  let actionMetadata: Record<string, string>;
  let peprValidateRequest: PeprValidateRequest<KubernetesObject>;

  beforeEach(() => {
    binding = clone(testBinding);
    actionMetadata = clone(testActionMetadata);
    peprValidateRequest = testPeprValidateRequest(testAdmissionRequest);
  });

  it("responds on successful validation action", async () => {
    const cbResult = {
      allowed: true,
      statusCode: 200,
      statusMessage: "yay",
    };
    const callback = jest.fn().mockImplementation(() => cbResult) as Binding["validateCallback"];
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

  it("responds on unsuccessful validation action", async () => {
    const callback = jest.fn().mockImplementation(() => {
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
});

describe("validateProcessor", () => {
  let config: ModuleConfig;
  beforeEach(() => {
    jest.clearAllMocks();
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

    const spyStart = jest.spyOn(MeasureWebhookTimeout.prototype, "start");

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

    const spyConvert = jest.spyOn(utils, "convertFromBase64Map");

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

    const spyStop = jest.spyOn(MeasureWebhookTimeout.prototype, "stop");

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const spyProcessRequest = jest.spyOn(require("./validate-processor"), "processRequest");

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
          validateCallback: jest.fn(),
        },
      ],
    } as unknown as Capability);

    const req = testAdmissionRequest;
    const reqMetadata = {};

    // This rule is skipped because we cannot mock this function globally as it is tested above
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const spyProcessRequest = jest.spyOn(require("./validate-processor"), "processRequest");
    (shouldSkipRequest as jest.Mock).mockReturnValue("Skip reason");

    await validateProcessor(config, [capability], req, reqMetadata);

    expect(spyProcessRequest).not.toHaveBeenCalled();

    spyProcessRequest.mockRestore();
  });
});
