// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprControllerStore } from "./store";
import { CapabilityCfg } from "../types";
import { Capability } from "../capability";
import { Schedule } from "../schedule";
import { PeprStore } from "../k8s";
import { afterEach, describe, it, jest } from "@jest/globals";
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

  const testCapability = new Capability(capabilityConfig);

  const mockSchedule: Schedule = {
    name: "test-schedule",
    every: 5,
    unit: "minutes",
    run: jest.fn(),
    startTime: new Date(),
    completions: 1,
  };

  const mockPeprStore = new PeprStore();

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe("when initializing the store", () => {
    it("do something", async () => {
      jest.useFakeTimers(); // Use fake timers

      mockK8s.mockImplementation(
        <T extends GenericClass, K extends KubernetesObject>() =>
          ({
            Patch: jest.fn().mockResolvedValueOnce(undefined as never),
            InNamespace: jest.fn().mockReturnValueOnce({
              // eslint-disable-next-line max-nested-callbacks
              Get: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
            }),
            Watch: jest.fn().mockReturnValueOnce(undefined),
            Apply: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
          }) as unknown as K8sInit<T, K>,
      );

      testCapability.OnSchedule(mockSchedule);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-schedule`, () => {
        new PeprControllerStore([], `pepr-test-schedule`, () => {});
      });
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
    });

    it("should migrate and setup the watch (with schedule)", async () => {
      mockK8s.mockImplementation(
        <T extends GenericClass, K extends KubernetesObject>() =>
          ({
            Patch: jest.fn().mockResolvedValueOnce(undefined as never),
            InNamespace: jest.fn().mockReturnValueOnce({
              // eslint-disable-next-line max-nested-callbacks
              Get: jest.fn().mockRejectedValueOnce(new Error("errrr") as never),
            }),
            Watch: jest.fn().mockReturnValueOnce(undefined),
            Apply: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
          }) as unknown as K8sInit<T, K>,
      );

      testCapability.OnSchedule(mockSchedule);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-schedule`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
    });

    it("should create the store resource for a scheduled capability (without schedule)", async () => {
      mockK8s.mockImplementation(
        <T extends GenericClass, K extends KubernetesObject>() =>
          ({
            Patch: jest.fn().mockResolvedValueOnce(undefined as never),
            InNamespace: jest.fn().mockReturnValueOnce({
              // eslint-disable-next-line max-nested-callbacks
              Get: jest.fn().mockRejectedValueOnce(new Error("errrr") as never),
              // Get: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
            }),
            Watch: jest.fn().mockReturnValueOnce(undefined),
            Apply: jest.fn().mockResolvedValueOnce(mockPeprStore as never),
          }) as unknown as K8sInit<T, K>,
      );
      testCapability.OnSchedule(mockSchedule);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-store`, () => {});
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
    });
  });
});
