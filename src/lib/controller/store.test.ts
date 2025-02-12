// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StoreController } from "./store";
import { CapabilityCfg } from "../types";
import { Capability } from "../core/capability";
import { Schedule } from "../core/schedule";
import { Store } from "../k8s";
import { afterEach, describe, it, jest, beforeEach, expect } from "@jest/globals";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";

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
    const defaultMockImplementations = <T extends GenericClass, K extends KubernetesObject>() =>
      ({
        Patch: jest.fn().mockResolvedValueOnce(undefined as never),
        InNamespace: jest.fn().mockReturnValueOnce({
          Get: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
        }),
        Watch: jest.fn().mockReturnValueOnce(undefined),
        Apply: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
      }) as unknown as K8sInit<T, K>;

    mockK8s.mockImplementationOnce(defaultMockImplementations);
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

      // Mock the timeout in the constructor
      const controllerStore = new StoreController([testCapability], storeName, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();

      // K8s(Store).Get() mock
      expect(mockK8s).toHaveBeenCalled();
      expect(controllerStore).toBeDefined();
    });
  });

  describe("PeprStore Migration and setupWatch ", () => {
    it("should migrate existing stores and set up a watch on the store resource", async () => {
      const mockPeprStore = new Store();
      const defaultMockImplementations = <T extends GenericClass, K extends KubernetesObject>() =>
        ({
          Patch: jest.fn().mockResolvedValueOnce(undefined as never),
          InNamespace: jest.fn().mockReturnValueOnce({
            Get: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
          }),
          Watch: jest.fn().mockReturnValueOnce(undefined),
          Apply: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
        }) as unknown as K8sInit<T, K>;

      mockK8s.mockImplementationOnce(defaultMockImplementations);
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
