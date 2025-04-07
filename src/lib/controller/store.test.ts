// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StoreController } from "./store";
import { CapabilityCfg } from "../types";
import { Capability } from "../core/capability";
import { Schedule } from "../core/schedule";
import { Store } from "../k8s";
import { afterEach, describe, it, jest, beforeEach, expect } from "@jest/globals";
import { K8s } from "kubernetes-fluent-client";
import Log from "../telemetry/logger";

jest.mock("kubernetes-fluent-client");
jest.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("StoreController", () => {
  const mockK8s = jest.mocked(K8s);
  const mockLog = jest.mocked(Log);
  const capabilityConfig: CapabilityCfg = {
    name: "test-capability",
    description: "Test capability description",
    namespaces: ["default"],
  };

  let testCapability: Capability;

  const mockSchedule: Schedule = {
    name: "test-schedule",
    every: 5,
    unit: "minutes",
    run: jest.fn(),
    startTime: new Date(),
    completions: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test
    mockLog.info.mockClear(); // Explicitly clear the logger mock
    testCapability = new Capability(capabilityConfig);
    const mockImplementation = createMockImplementation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockK8s.mockImplementation(() => mockImplementation as any);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createMockImplementation = () => {
    const mockPeprStore = new Store();
    return {
      Patch: jest.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      InNamespace: jest.fn().mockReturnValue({
        Get: jest.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      }),
      Watch: jest.fn().mockReturnValue({
        start: jest.fn().mockReturnValue(Promise.resolve()),
      }),
      Apply: jest.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      Logs: jest.fn().mockReturnValue(Promise.resolve([] as string[])),
      Get: jest.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      Delete: jest.fn().mockReturnValue(Promise.resolve()),
    };
  };

  describe("PeprStore initialization", () => {
    it.each([
      ["with schedule", `pepr-test-schedule`, true],
      ["without schedule", `pepr-test-store`, false],
    ])("should initialize the store %s", async (_, storeName, withSchedule) => {
      if (withSchedule) {
        testCapability.OnSchedule(mockSchedule);
      }

      const controllerStore = new StoreController([testCapability], storeName, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();

      const mockLogCalls = mockLog.info.mock.calls.flatMap(call => call);
      expect(mockLogCalls).toEqual([
        "Capability test-capability registered",
        `Registering ${withSchedule ? "schedule " : ""}store for test-capability`,
      ]);
      expect(mockK8s).toHaveBeenCalled();
      expect(controllerStore).toBeDefined();
      expect(mockLog.debug).toHaveBeenCalledWith(capabilityConfig);
    });
  });

  describe("PeprStore Migration and setupWatch ", () => {
    it("should migrate existing stores and set up a watch on the store resource", async () => {
      new StoreController([testCapability], `pepr-test-schedule`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();

      const mockLogCalls = mockLog.info.mock.calls.flatMap(call => call);
      expect(mockLogCalls).toEqual(["Capability test-capability registered"]);
      // K8s API calls verification
      expect(mockK8s).toHaveBeenCalled();
      // K8s(Store).Watch() mock - setupWatch
      expect(mockK8s).toHaveBeenCalled();
    });
  });
});
