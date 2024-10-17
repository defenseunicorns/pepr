// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprControllerStore } from "./store";
import Log from "../logger";
import { CapabilityCfg } from "../types";
import { Capability } from "../capability";
import { Schedule } from "../schedule";
import { PeprStore } from "../k8s";
import { describe, it, jest } from "@jest/globals";

describe("pepr store tests", () => {
  describe("when initializing the store", () => {
    it("do something", async () => {
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

      testCapability.OnSchedule(mockSchedule);

      const mockPeprStore = new PeprStore();
      jest.useFakeTimers(); // Use fake timers

      jest.mock("kubernetes-fluent-client", () => ({
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnThis(),
          // eslint-disable-next-line max-nested-callbacks
          Get: jest.fn().mockImplementationOnce(() => {
            return Promise.resolve(mockPeprStore);
          }),
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-schedule`, () => {
        Log.info("✅ Test setup complete");
        // Initialize the schedule store for each capability
        new PeprControllerStore([], `pepr-test-schedule`, () => {
          Log.info("✅ Test scheduling complete");
        });
      });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      // Fast-forward time
      // jest.runAllTimers();

      // Assert the private method was called
      // ??
      jest.useRealTimers();
    });

    it("should migrate and setup the watch (with schedule)", async () => {
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

      testCapability.OnSchedule(mockSchedule);

      jest.mock("kubernetes-fluent-client", () => ({
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnThis(),
          Get: jest.fn().mockReturnThis(),
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-schedule`, () => {
        Log.info("✅ Test setup complete");
        // Initialize the schedule store for each capability
        new PeprControllerStore([], `pepr-test-schedule`, () => {
          Log.info("✅ Test scheduling complete");
        });
      });

      // Fast-forward time
      // jest.runAllTimers();

      // Assert the private method was called
      // ??
    });
    it("should create the store resource for a scheduled capability (without schedule)", async () => {
      const capabilityConfig: CapabilityCfg = {
        name: "test-capability",
        description: "Test capability description",
        namespaces: ["default"],
      };

      const testCapability = new Capability(capabilityConfig);

      jest.mock("kubernetes-fluent-client", () => ({
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnThis(),
          Get: jest.fn().mockReturnThis(),
        }),
      }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const peprControllerStore = new PeprControllerStore([testCapability], `pepr-test-store`, () => {
        Log.info("✅ Test setup complete");
        // Initialize the schedule store for each capability
        new PeprControllerStore([], `pepr-test-schedule`, () => {
          Log.info("✅ Test scheduling complete");
        });
      });

      // Fast-forward time
      // jest.runAllTimers();

      // Assert the private method was called
      // ??
    });
  });
});
