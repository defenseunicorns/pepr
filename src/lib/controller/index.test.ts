// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { afterEach, describe, it, vi, beforeEach, expect } from "vitest";
import { Controller, ControllerHooks, getContextAndLog } from "./index";
import { Capability } from "../core/capability";
import { ModuleConfig, CapabilityCfg } from "../types";
import { AdmissionRequest } from "../common-types";
import { Operation } from "../enums";
import express from "express";

vi.mock("./store", () => {
  return {
    StoreController: vi.fn().mockImplementation((_capabilities, _name, onReady) => {
      if (typeof onReady === "function") {
        onReady();
      }
    }),
  };
});
vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Controller", () => {
  let mockConfig: ModuleConfig;
  let mockCapabilities: Capability[];
  let mockHooks: ControllerHooks;
  let controller: Controller;

  beforeEach(() => {
    mockConfig = { uuid: "test-uuid" } as ModuleConfig;

    const mockCapabilityConfig: CapabilityCfg = {
      name: `test-capability-${Math.random()}`,
      description: "Test capability description",
      namespaces: ["default"],
    };
    mockCapabilities = [new Capability(mockCapabilityConfig)];

    mockHooks = {
      beforeHook: vi.fn(),
      afterHook: vi.fn(),
      onReady: vi.fn(),
    };

    controller = new Controller(mockConfig, mockCapabilities, mockHooks);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should initialize with provided config, capabilities, and hooks", () => {
    expect(controller).toBeDefined();
    expect(mockHooks.onReady).toHaveBeenCalled();
  });
});

describe("getContextAndLog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("builds reqMetadata with name prefixed by '/', preserves namespace & kind, logs info/debug, and returns context", () => {
    const request: AdmissionRequest = {
      uid: "abc-123",
      name: "my-cm",
      namespace: "demo",
      kind: { group: "", version: "v1", kind: "ConfigMap" },
      resource: { group: "", version: "v1", resource: "configmaps" },
      operation: Operation.CREATE,
      object: {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name: "my-cm", namespace: "demo" },
      },
      userInfo: {},
    };

    const req = { body: { request } } as unknown as express.Request;

    const result = getContextAndLog(req, "Mutate");

    expect(result.request).toBe(request);
    expect(result.reqMetadata).toEqual({ uid: "abc-123", namespace: "demo", name: "/my-cm" });
  });

  it("handles missing fields: empty name/namespace, default gvk, undefined uid/operation", () => {
    const req = { body: {} } as unknown as express.Request;

    const result = getContextAndLog(req, "Validate");

    expect(result.reqMetadata).toEqual({
      uid: undefined as unknown as string,
      namespace: "",
      name: "",
    });
  });

  it("does not prefix name when request.name is falsy", () => {
    const request = {
      uid: "z-1",
      name: "", // falsy
      namespace: "",
      kind: undefined,
      operation: undefined,
      // minimal object to satisfy type at runtime; not strictly required for the function
      object: { apiVersion: "v1", kind: "ConfigMap", metadata: { name: "" } },
      resource: { group: "", version: "v1", resource: "configmaps" },
      userInfo: {},
    } as unknown as AdmissionRequest;

    const req = { body: { request } } as unknown as express.Request;

    const { reqMetadata } = getContextAndLog(req, "Mutate");
    expect(reqMetadata.name).toBe(""); // no leading slash when name is falsy
  });
});
