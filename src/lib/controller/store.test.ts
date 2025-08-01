// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StoreController } from "./store";
import { CapabilityCfg } from "../types";
import { Capability } from "../core/capability";
import { Schedule } from "../core/schedule";
import { Store } from "../k8s";
import { afterEach, describe, it, type MockInstance, vi, beforeEach, expect } from "vitest";
import { K8s } from "kubernetes-fluent-client";
import Log from "../telemetry/logger";

vi.mock("kubernetes-fluent-client");
vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("StoreController", () => {
  const mockK8s = vi.mocked(K8s);
  const mockLog = vi.mocked(Log);
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
    run: vi.fn(),
    startTime: new Date(),
    completions: 1,
  };

  beforeEach(() => {
    process.env.PEPR_LOG_LEVEL = "debug";
    vi.clearAllMocks(); // Clear all mocks before each test
    mockLog.info.mockClear(); // Explicitly clear the logger mock
    mockLog.debug.mockClear();
    testCapability = new Capability(capabilityConfig);
    const mockImplementation = createMockImplementation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockK8s.mockImplementation(() => mockImplementation as any);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  type MockImplementation = {
    Patch: MockInstance<() => Promise<Store>>;
    InNamespace: MockInstance<
      () => {
        Get: MockInstance<() => Promise<Store>>;
      }
    >;
    Watch: MockInstance<
      () => {
        start: MockInstance<() => Promise<void>>;
      }
    >;
    Apply: MockInstance<() => Promise<Store>>;
    Logs: MockInstance<() => Promise<string[]>>;
    Get: MockInstance<() => Promise<Store>>;
    Delete: MockInstance<() => Promise<void>>;
  };
  const createMockImplementation = (): MockImplementation => {
    const mockPeprStore = new Store();
    return {
      Patch: vi.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      InNamespace: vi.fn().mockReturnValue({
        Get: vi.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      }),
      Watch: vi.fn().mockReturnValue({
        start: vi.fn().mockReturnValue(Promise.resolve()),
      }),
      Apply: vi.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      Logs: vi.fn().mockReturnValue(Promise.resolve([] as string[])),
      Get: vi.fn().mockReturnValue(Promise.resolve(mockPeprStore)),
      Delete: vi.fn().mockReturnValue(Promise.resolve()),
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
      vi.advanceTimersToNextTimer();
      await Promise.resolve();

      const mockLogCalls = mockLog.debug.mock.calls.flatMap(call => call);
      expect(mockLogCalls[0]).toEqual("Capability test-capability registered");
      expect(mockLogCalls[2]).toEqual(
        `Registering ${withSchedule ? "schedule " : ""}store for test-capability`,
      );

      expect(mockK8s).toHaveBeenCalled();
      expect(controllerStore).toBeDefined();
      expect(mockLog.debug).toHaveBeenCalledWith(capabilityConfig);
    });
  });

  describe("PeprStore Migration and setupWatch ", () => {
    it("should migrate existing stores and set up a watch on the store resource", async () => {
      new StoreController([testCapability], `pepr-test-schedule`, () => {});
      vi.advanceTimersToNextTimer();
      await Promise.resolve();

      const mockLogCalls = mockLog.debug.mock.calls.flatMap(call => call);
      expect(mockLogCalls[0]).toEqual("Capability test-capability registered");
      expect(mockLogCalls[1].name).toEqual("test-capability");
      // K8s API calls verification
      expect(mockK8s).toHaveBeenCalled();
      // K8s(Store).Watch() mock - setupWatch
      expect(mockK8s).toHaveBeenCalled();
    });
  });
});
