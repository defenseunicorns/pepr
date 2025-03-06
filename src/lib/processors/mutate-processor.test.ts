// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { clone } from "ramda";
import { ModuleConfig } from "../types";
import { PeprMutateRequest } from "../mutate-request";
import { AdmissionRequest, Binding, MutateAction } from "../types";
import { Event, Operation } from "../enums";
import { base64Encode } from "../utils";
import { GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { MutateResponse } from "../k8s";
import { OnError } from "../../cli/init/enums";
import {
  updateResponsePatchAndWarnings,
  Bindable,
  mutateProcessor,
  updateStatus,
  logMutateErrorMessage,
  processRequest,
} from "./mutate-processor";
import { Operation as JSONPatchOperation } from "fast-json-patch";
import { Capability } from "../core/capability";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import { decodeData } from "./decode-utils";

jest.mock("./decode-utils", () => ({
  decodeData: jest.fn(),
}));

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

jest.mock("../utils");

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
  (decodeData as jest.Mock).mockReturnValue({
    wrapped: { mockWrapped: true },
    skipped: [],
  });
});

describe("updateStatus", () => {
  describe("when given non-delete request", () => {
    it("adds status annotation to to-be-admitted resource", () => {
      const name = "capa";
      const status = "test-status";
      const annote = `${defaultModuleConfig.uuid}.pepr.dev/${name}`;

      const result = updateStatus(defaultModuleConfig, name, defaultPeprMutateRequest(), status);

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

      const result = updateStatus(
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
    const result = logMutateErrorMessage(new Error(err));
    expect(result).toBe(res);
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

const defaultBindable: Bindable = {
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

    const result = await processRequest(defaultBindable, testPeprMutateRequest, testMutateResponse);

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
    testBindable.config.onError = OnError.REJECT;
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);
    const annote = `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`;

    const result = await processRequest(testBindable, testPeprMutateRequest, testMutateResponse);

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
    testBindable.config.onError = OnError.AUDIT;
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);
    const annote = `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`;

    const result = await processRequest(testBindable, testPeprMutateRequest, testMutateResponse);

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
    const timeWindowMs = 10;
    expect(Date.now() - parseInt(key)).toBeLessThan(timeWindowMs);
    expect(val).toBe("Action failed: An error occurred with the mutate action.");
  });
});

describe("updateResponsePatchAndWarnings", () => {
  const mutateResponse: MutateResponse = { uid: "uid", allowed: true, patch: "" };
  const patches: JSONPatchOperation[] = [{ op: "add", path: "/data/hello-pepr-v2-a", value: "value" }];
  it("should add a patch to the response if patch length is greater than 0", () => {
    updateResponsePatchAndWarnings(patches, mutateResponse);
    expect(mutateResponse.patch).toBe(base64Encode(JSON.stringify(patches)));
    expect(mutateResponse.patchType).toBe("JSONPatch");
  });

  it("should remove warnings from the response if warnings are empty", () => {
    const localMutateResponse = { ...mutateResponse, warnings: [] };
    expect(localMutateResponse.warnings.length).toBe(0);
    updateResponsePatchAndWarnings(patches, localMutateResponse);
    expect(localMutateResponse.warnings).not.toBeDefined();
  });
});

describe("mutateProcessor", () => {
  let config: ModuleConfig;
  let capability: Capability;
  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      webhookTimeout: 11,
      uuid: "some-uuid",
      alwaysIgnore: {},
    };
    capability = new Capability({
      name: "test",
      description: "test",
    });
    (decodeData as jest.Mock).mockReturnValue({
      wrapped: { mockWrapped: true },
      skipped: [],
    });
  });

  it("should measure if a timeout occurred based on webhookTimeout", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    const spyStart = jest.spyOn(MeasureWebhookTimeout.prototype, "start");

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(spyStart).toHaveBeenCalledWith(config.webhookTimeout);
    spyStart.mockRestore();
  });

  it("should stop the timer after processing", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    const spyStop = jest.spyOn(MeasureWebhookTimeout.prototype, "stop");

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(spyStop).toHaveBeenCalled();
    spyStop.mockRestore();
  });

  it("should call decodeData", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    (decodeData as jest.Mock).mockReturnValue({
      wrapped: { mockWrapped: true },
      skipped: [],
    });

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(decodeData).toHaveBeenCalled();
  });
});
