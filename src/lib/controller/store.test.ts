// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StoreController } from "./store";
import { CapabilityCfg } from "../types";
import { Capability } from "../core/capability";
import { Schedule } from "../core/schedule";
import { Store } from "../k8s";
import { afterEach, describe, it, jest, beforeEach, expect } from "@jest/globals";
import { K8s } from "kubernetes-fluent-client";

jest.mock("kubernetes-fluent-client");

describe("StoreController", () => {
  const mockK8s = jest.mocked(K8s);
  const capabilityConfig: CapabilityCfg = {
    name: "test-capability",
    description: "Test capability description",
    namespaces: ["default"],
  };

  let testCapability = new Capability(capabilityConfig);

  const mockSchedule: Schedule = {
    name: "test-schedule",
    every: 5,
    unit: "minutes",
    run: jest.fn(),
    startTime: new Date(),
    completions: 1,
  };

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  beforeEach(() => {
    testCapability = new Capability(capabilityConfig);
    const mockPeprStore = new Store();

    const mockImplementation = {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockK8s.mockImplementation(() => mockImplementation as any);
    jest.useFakeTimers();
  });

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

      expect(mockK8s).toHaveBeenCalled();
      expect(controllerStore).toBeDefined();
    });
  });

  describe("PeprStore Migration and setupWatch ", () => {
    it("should migrate existing stores and set up a watch on the store resource", async () => {
      const mockPeprStore = new Store();

      const mockImplementation = {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockK8s.mockImplementation(() => mockImplementation as any);
      new StoreController([testCapability], `pepr-test-schedule`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();

      // K8s(Store).Patch() mock - migrateAndSetupWatch
      expect(mockK8s).toHaveBeenCalled();
      // K8s(Store).Watch() mock - setupWatch
      expect(mockK8s).toHaveBeenCalled();
    });
  });
});
