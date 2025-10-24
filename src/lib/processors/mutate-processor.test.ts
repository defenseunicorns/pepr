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
import { reencodeData } from "./decode-utils";
import { shouldSkipRequest } from "../filter/filter";
import { kind } from "kubernetes-fluent-client";

vi.mock("./decode-utils", () => ({
  decodeData: vi.fn(),
  reencodeData: vi.fn(),
}));

vi.mock("../telemetry/logger", () => {
  const childLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };
  return {
    default: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => childLogger),
    },
  };
});

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
  getIgnoreNamespaces: vi.fn(),
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

function capabilityWithMutate(
  mutateFn: Mock,
  kind: { group: string; version: string; kind: string } = {
    group: "",
    version: "v1",
    kind: "ConfigMap",
  },
): Capability {
  const cap = new Capability({ name: "cap", description: "desc" });

  const FakeModel = function FakeModel() {} as unknown as GenericClass;
  cap.When(FakeModel, kind).IsCreated().Mutate(mutateFn);
  return cap;
}

describe("processRequest", () => {
  it("adds a status annotation on success", async () => {
    const testPeprMutateRequest = defaultPeprMutateRequest();
    const testMutateResponse = clone(defaultMutateResponse) as MutateResponse;
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

describe("mutateProcessor (bindings & branches via DSL)", () => {
  const reqBase: AdmissionRequest<kind.ConfigMap> = {
    uid: "uid-123",
    kind: { kind: "ConfigMap", group: "", version: "v1" },
    resource: { group: "", version: "v1", resource: "configmaps" },
    name: "cm-1",
    object: {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: "cm-1", namespace: "ns" },
      data: { a: "1" },
    },
    operation: Operation.CREATE,
    userInfo: {},
  };

  let config: ModuleConfig;

  beforeEach(() => {
    config = {
      uuid: "mod-uuid",
      webhookTimeout: 10,
      alwaysIgnore: {},
    } as ModuleConfig;

    // Default path: do not skip bindings
    (shouldSkipRequest as unknown as Mock).mockReturnValue("");

    // Default decode returns a fresh PeprMutateRequest so updateStatus/processRequest can mutate it
    (decodeData as Mock).mockImplementation((wrappedReq: PeprMutateRequest<KubernetesObject>) => ({
      wrapped: new PeprMutateRequest(wrappedReq.Request ?? reqBase),
      skipped: [],
    }));
  });

  it("returns allowed=true when there are no bindings (no matches)", async () => {
    const cap = new Capability({ name: "empty-cap", description: "no bindings" });

    const res = await mutateProcessor(config, [cap], reqBase, {});

    expect(res.allowed).toBe(true);
    expect(res.patch).toBeUndefined(); // nothing changed
  });

  it("returns allowed=true early for DELETE and does not invoke mutate callback", async () => {
    const mutateCb = vi.fn().mockResolvedValue(undefined);
    const cap = capabilityWithMutate(mutateCb);

    // For DELETE, AdmissionReview usually supplies oldObject (the existing resource)
    const reqDelete: AdmissionRequest = {
      ...reqBase,
      operation: Operation.DELETE,
      object: reqBase.object, // typical for DELETE
      oldObject: {
        // provide the prior object so PeprMutateRequest can populate Raw
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name: "cm-1", namespace: "ns" },
        data: { a: "1" },
      } as kind.ConfigMap,
    };

    // Realistically, a CREATE mutate binding should be skipped for a DELETE op.
    (shouldSkipRequest as unknown as Mock).mockReturnValue("skip: not applicable for DELETE");

    const spyStop = vi.spyOn(MeasureWebhookTimeout.prototype, "stop");
    const res = await mutateProcessor(config, [cap], reqDelete, {});

    expect(mutateCb).not.toHaveBeenCalled(); // skipped on DELETE
    expect(res.allowed).toBe(true); // early-allow path
    expect(res.patch).toBeUndefined();
    expect(spyStop).toHaveBeenCalled();
    spyStop.mockRestore();
  });

  it("sets JSONPatch when reencodeData returns a changed object", async () => {
    // Ensure binding isn’t skipped
    (shouldSkipRequest as unknown as Mock).mockReturnValue("");

    // ensure base64Encode actually encodes
    (base64Encode as unknown as Mock).mockImplementation((s: string) =>
      Buffer.from(s).toString("base64"),
    );

    const mutateCb = vi.fn().mockResolvedValue(undefined);
    const cap = capabilityWithMutate(mutateCb);

    // Clone to isolate from other tests
    const req = JSON.parse(JSON.stringify(reqBase)) as typeof reqBase;

    // Return a *different* object from reencodeData
    const transformed = {
      ...req.object,
      data: { ...req.object.data, b: "2" },
    };
    (reencodeData as unknown as Mock).mockReset();
    (reencodeData as unknown as Mock).mockReturnValue(transformed);

    const res = await mutateProcessor(config, [cap], req, {});

    expect(reencodeData).toHaveBeenCalled(); // we reached reencode/patch phase
    expect(res.allowed).toBe(true);
    expect(res.patchType).toBe("JSONPatch");
    expect(res.patch).toBeDefined();

    const decoded = JSON.parse(Buffer.from(res.patch!, "base64").toString("utf-8"));
    expect(Array.isArray(decoded)).toBe(true);
    expect(
      (decoded as { op: string; path: string; value?: unknown }[]).some(
        op => op.op === "add" && op.path === "/data/b" && op.value === "2",
      ),
    ).toBe(true);
  });

  it("early-returns on onError=REJECT when mutate callback throws", async () => {
    const throwing = vi.fn().mockImplementation(() => {
      throw new Error("boom");
    });
    const cap = capabilityWithMutate(throwing);

    const cfgReject: ModuleConfig = { ...config, onError: OnError.REJECT } as ModuleConfig;

    const spyStop = vi.spyOn(MeasureWebhookTimeout.prototype, "stop");
    const res = await mutateProcessor(cfgReject, [cap], reqBase, {});

    expect(res.allowed).toBe(false); // early return before allowed flips to true
    expect(res.result).toBe("Pepr module configured to reject on error");
    expect(res.warnings && res.warnings.length).toBeGreaterThan(0);
    expect(spyStop).toHaveBeenCalled();
    spyStop.mockRestore();
  });
});
