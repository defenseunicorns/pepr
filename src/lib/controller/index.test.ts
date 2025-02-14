// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { afterEach, describe, it, jest, beforeEach, expect } from "@jest/globals";
import { Controller, ControllerHooks } from "./index";
import { Capability } from "../core/capability";
import { ModuleConfig, CapabilityCfg } from "../types";

jest.mock("./store", () => {
  return {
    StoreController: jest.fn().mockImplementation((_capabilities, _name, onReady) => {
      if (typeof onReady === "function") {
        onReady();
      }
    }),
  };
});

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
      beforeHook: jest.fn(),
      afterHook: jest.fn(),
      onReady: jest.fn(),
    };

    controller = new Controller(mockConfig, mockCapabilities, mockHooks);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("should initialize with provided config, capabilities, and hooks", () => {
    expect(controller).toBeDefined();
    expect(mockHooks.onReady).toHaveBeenCalled();
  });
});
