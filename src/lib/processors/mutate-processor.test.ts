// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { clone } from "ramda";
import { ModuleConfig } from "../types";
import { PeprMutateRequest } from "../mutate-request";
import { AdmissionRequest } from "../common-types";
import { Binding, MutateAction } from "../types";
import { Event, Operation } from "../enums";
import { base64Encode } from "../utils";
import { GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { MutateResponse, WebhookIgnore } from "../k8s";
import { OnError } from "../../cli/init/enums";
import {
  updateResponsePatchAndWarnings,
  Bindable,
  mutateProcessor,
  updateStatus,
  logMutateErrorMessage,
  processRequest,
  getIgnoreNamespaces,
} from "./mutate-processor";
import { Operation as JSONPatchOperation } from "fast-json-patch";
import { Capability } from "../core/capability";
import { MeasureWebhookTimeout } from "../telemetry/webhookTimeouts";
import { decodeData } from "./decode-utils";
import { resolveIgnoreNamespaces } from "../assets/ignoredNamespaces";

vi.mock("./decode-utils", () => ({
  decodeData: vi.fn(),
}));

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

vi.mock("../utils");

vi.mock("../assets/ignoredNamespaces", () => ({
  resolveIgnoreNamespaces: vi.fn(),
}));

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

const defaultPeprMutateRequest = (
  admissionRequest = defaultAdmissionRequest,
): PeprMutateRequest<KubernetesObject> => new PeprMutateRequest(admissionRequest);

beforeEach(() => {
  vi.resetAllMocks();
  (decodeData as Mock).mockReturnValue({
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
  mutateCallback: vi.fn() as Mock<MutateAction<GenericClass, KubernetesObject>>,
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

const ignore = (namespaces?: string[]): WebhookIgnore => ({ namespaces });

const baseConfig = (overrides?: Partial<ModuleConfig>): ModuleConfig => ({
  uuid: "test-uuid",
  alwaysIgnore: ignore([]), // default: empty list is fine
  ...overrides,
});

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
    const mutateCallback = (
      vi.fn() as Mock<MutateAction<GenericClass, KubernetesObject>>
    ).mockImplementation(() => {
      throw "oof";
    });
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
    expect(result.response.warnings![0]).toBe(
      "Action failed: An error occurred with the mutate action.",
    );
    expect(result.response.result).toBe("Pepr module configured to reject on error");
    expect(result.response.auditAnnotations).toBeUndefined();
  });

  it("adds a status annotation, warning, and auditAnnotation on failure when Errors.audit", async () => {
    const mutateCallback = (
      vi.fn() as Mock<MutateAction<GenericClass, KubernetesObject>>
    ).mockImplementation(() => {
      throw "oof";
    });
    const testBinding = { ...clone(defaultBinding), mutateCallback };
    const testBindable = { ...clone(defaultBindable), binding: testBinding };
    testBindable.config.onError = OnError.AUDIT;
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse);

    const result = await processRequest(testBindable, testPeprMutateRequest, testMutateResponse);

    expect(result).toEqual({ wrapped: testPeprMutateRequest, response: testMutateResponse });
    expect(result.wrapped.Raw.metadata?.annotations).toBeDefined();
    expect(
      result.wrapped.Raw.metadata!.annotations![
        `${defaultModuleConfig.uuid}.pepr.dev/${defaultBindable.name}`
      ],
    ).toBe("warning");

    expect(result.response.warnings).toHaveLength(1);
    expect(result.response.warnings![0]).toBe(
      "Action failed: An error occurred with the mutate action.",
    );
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
  const patches: JSONPatchOperation[] = [
    { op: "add", path: "/data/hello-pepr-v2-a", value: "value" },
  ];
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
    vi.clearAllMocks();
    config = {
      webhookTimeout: 11,
      uuid: "some-uuid",
      alwaysIgnore: {},
    };
    capability = new Capability({
      name: "test",
      description: "test",
    });
    (decodeData as Mock).mockReturnValue({
      wrapped: { mockWrapped: true },
      skipped: [],
    });
  });

  it("should measure if a timeout occurred based on webhookTimeout", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    const spyStart = vi.spyOn(MeasureWebhookTimeout.prototype, "start");

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(spyStart).toHaveBeenCalledWith(config.webhookTimeout);
    spyStart.mockRestore();
  });

  it("should stop the timer after processing", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    const spyStop = vi.spyOn(MeasureWebhookTimeout.prototype, "stop");

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(spyStop).toHaveBeenCalled();
    spyStop.mockRestore();
  });

  it("should call decodeData", async () => {
    const req = defaultAdmissionRequest;
    const reqMetadata = {};

    (decodeData as Mock).mockReturnValue({
      wrapped: { mockWrapped: true },
      skipped: [],
    });

    await mutateProcessor(config, [capability], req, reqMetadata);

    expect(decodeData).toHaveBeenCalled();
  });
});

describe("getIgnoreNamespaces", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prefers config.alwaysIgnore.namespaces when non-empty", () => {
    const config = baseConfig({
      alwaysIgnore: ignore(["ns-a", "ns-b"]),
      admission: { alwaysIgnore: ignore(["fb-1"]) },
    });

    (resolveIgnoreNamespaces as unknown as Mock).mockReturnValue(["resolved-a", "resolved-b"]);

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(resolveIgnoreNamespaces).toHaveBeenCalledWith(["ns-a", "ns-b"]);
    expect(result).toEqual(["resolved-a", "resolved-b"]);
  });

  it("falls back to config.admission.alwaysIgnore.namespaces when primary is empty", () => {
    const config = baseConfig({
      alwaysIgnore: ignore([]),
      admission: { alwaysIgnore: ignore(["fb-a", "fb-b"]) },
    });

    (resolveIgnoreNamespaces as unknown as Mock).mockReturnValue(["resolved-fallback"]);

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(resolveIgnoreNamespaces).toHaveBeenCalledWith(["fb-a", "fb-b"]);
    expect(result).toEqual(["resolved-fallback"]);
  });

  it("falls back when primary is undefined", () => {
    const config = baseConfig({
      // alwaysIgnore present but no namespaces
      alwaysIgnore: ignore(undefined),
      admission: { alwaysIgnore: ignore(["fb-only"]) },
    });

    (resolveIgnoreNamespaces as unknown as Mock).mockReturnValue(["resolved-fb-only"]);

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(resolveIgnoreNamespaces).toHaveBeenCalledWith(["fb-only"]);
    expect(result).toEqual(["resolved-fb-only"]);
  });

  it("passes undefined when both sources are absent/empty", () => {
    const config = baseConfig({
      alwaysIgnore: ignore([]),
      admission: { alwaysIgnore: ignore([]) },
    });

    (resolveIgnoreNamespaces as unknown as Mock).mockReturnValue(undefined);

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(resolveIgnoreNamespaces).toHaveBeenCalledWith([]);
    expect(result).toBeUndefined();
  });

  it("handles undefined config by passing undefined to resolver", () => {
    (resolveIgnoreNamespaces as unknown as Mock).mockReturnValue(undefined);

    const result = getIgnoreNamespaces(undefined);

    expect(resolveIgnoreNamespaces).toHaveBeenCalledWith(undefined);
    expect(result).toBeUndefined();
  });
});
