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

describe("pepr store tests", () => {
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

  describe("when initializing the store", () => {
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
    it.skip("should migrate and setup the watch (with schedule)", async () => {
      testCapability.OnSchedule(mockSchedule);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const controllerStore = new StoreController([testCapability], `pepr-test-schedule`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
      expect(true).toBe(false); // store.ts only exposes a constructor, hard to test
    });

    it.skip("should create the store resource for a scheduled capability (without schedule)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const controllerStore = new StoreController([testCapability], `pepr-test-store`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
      expect(true).toBe(false); // store.ts only exposes a constructor, hard to test
    });
  });
});
