// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, expect, jest, it, describe, afterEach } from "@jest/globals";
import { clone } from "ramda";
import { Capability } from "./capability";
import { Schedule } from "./schedule";
import { PeprModule } from "./module";
import { PackageJSON } from "../types";
import { CapabilityExport } from "../types";
import { OnError } from "../../cli/init/enums";
import * as watchProcessor from "../processors/watch-processor";

// Mock Controller
const startServerMock = jest.fn();
jest.mock("../controller", () => ({
  Controller: jest.fn().mockImplementation(() => ({
    startServer: startServerMock,
  })),
}));

// Mock watch processor
// This needs to be outside of the test blocks
const setupWatchMock = jest.spyOn(watchProcessor, "setupWatch");

const mockPackageJSON: PackageJSON = {
  description: "Test Description",
  pepr: {
    uuid: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
    description: "Development module for pepr",
    onError: "ignore",
    alwaysIgnore: {
      namespaces: [],
    },
  },
};

// Define the controller hooks type
type ControllerHooks = {
  onReady: () => Promise<void>;
  beforeHook?: (req: unknown, res: unknown, next: () => void) => void;
  afterHook?: (req: unknown, res: unknown) => void;
};

describe("PeprModule", () => {
  // Reset mocks and env state before each test
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PEPR_MODE;
  });

  describe("when instantiated with default options", () => {
    it("should start the Controller with the default port", () => {
      new PeprModule(mockPackageJSON);
      expect(startServerMock).toHaveBeenCalledWith(3000);
    });
  });

  describe("when instantiated with deferStart option", () => {
    it("should not start the server automatically", () => {
      new PeprModule(mockPackageJSON, [], { deferStart: true });
      expect(startServerMock).not.toHaveBeenCalled();
    });

    it("should start the server with specified port when start method is called", () => {
      const module = new PeprModule(mockPackageJSON, [], { deferStart: true });
      const port = Math.floor(Math.random() * 10000) + 1000;
      module.start(port);
      expect(startServerMock).toHaveBeenCalledWith(port);
    });
  });

  describe("when validating onError configuration", () => {
    it("should throw an error for invalid onError conditions", () => {
      const invalidConfig = clone(mockPackageJSON);
      invalidConfig.pepr.onError = "invalidError";
      expect(() => new PeprModule(invalidConfig)).toThrow();
    });

    it("should accept valid onError conditions", () => {
      const validErrors = [OnError.AUDIT, OnError.IGNORE, OnError.REJECT];

      validErrors.forEach(errorType => {
        const validConfig = clone(mockPackageJSON);
        validConfig.pepr.onError = errorType;
        expect(() => new PeprModule(validConfig)).not.toThrow();
      });
    });
  });

  describe("when running in build mode", () => {
    const sendMock = jest.spyOn(process, "send").mockImplementation(() => true);

    beforeEach(() => {
      // Use the environment variable approach as it's part of the implementation
      process.env.PEPR_MODE = "build";
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should not create a controller", () => {
      new PeprModule(mockPackageJSON);
      expect(startServerMock).not.toHaveBeenCalled();
    });

    it("should send the capabilities to the parent process", () => {
      const capability = new Capability({
        name: "test",
        description: "test",
      });

      const expectedExport: CapabilityExport = {
        name: capability.name,
        description: capability.description,
        namespaces: capability.namespaces,
        bindings: capability.bindings,
        hasSchedule: capability.hasSchedule,
      };

      new PeprModule(mockPackageJSON, [capability]);
      expect(sendMock).toHaveBeenCalledWith([expectedExport]);
    });
  });

  describe("when testing controller hooks", () => {
    const capabilities = [
      new Capability({
        name: "test-capability",
        description: "test capability for hooks",
      }),
    ];

    const opts = {
      beforeHook: jest.fn(),
      afterHook: jest.fn(),
      deferStart: true,
    };

    const mockPkgJSON = clone(mockPackageJSON);
    mockPkgJSON.pepr.alwaysIgnore = {
      namespaces: ["kube-system", "kube-public"],
    };

    beforeEach(() => {
      process.env.PEPR_MODE = "watch";
      jest.resetAllMocks();
    });

    describe("when in watch mode", () => {
      it("should call setupWatch when controller is ready", async () => {
        // Create the module
        new PeprModule(mockPkgJSON, capabilities, opts);

        // Get the controller constructor mock
        const { Controller } = jest.mocked(await import("../controller"));

        // Verify controller was initialized
        expect(Controller).toHaveBeenCalled();

        // Get the hooks passed to the controller
        const controllerHooks = Controller.mock.calls[0][2] as ControllerHooks;

        // Call the onReady hook
        await controllerHooks.onReady();

        // Verify setupWatch was called with correct args
        expect(setupWatchMock).toHaveBeenCalledTimes(1);
        expect(setupWatchMock).toHaveBeenCalledWith(
          capabilities,
          expect.arrayContaining(["kube-system", "kube-public"]),
        );

        // Verify our hooks were passed through
        expect(controllerHooks.beforeHook).toBe(opts.beforeHook);
        expect(controllerHooks.afterHook).toBe(opts.afterHook);
      });

      it("should throw an error when setupWatch fails", async () => {
        // Setup mock to throw
        const mockError = new Error("Test watch setup error");
        setupWatchMock.mockImplementation(() => Promise.reject(mockError));

        // Create a module
        new PeprModule(mockPackageJSON, [], { deferStart: true });

        // Get the controller constructor mock
        const { Controller } = jest.mocked(await import("../controller"));

        // Get the hooks passed to the controller
        const controllerHooks = Controller.mock.calls[0][2] as ControllerHooks;

        // Call the onReady hook and expect it to throw
        await expect(controllerHooks.onReady()).rejects.toThrow(
          "Failed to set up watch: Test watch setup error",
        );

        expect(setupWatchMock).toHaveBeenCalledTimes(1);
      });

      it("should not call setupWatch when not in watch or dev mode", async () => {
        // For this test only, change the environment mode
        delete process.env.PEPR_MODE;

        // Create a module
        new PeprModule(mockPackageJSON, [], { deferStart: true });

        // Get the controller constructor mock
        const { Controller } = jest.mocked(await import("../controller"));

        // Get the hooks passed to the controller
        const controllerHooks = Controller.mock.calls[0][2] as ControllerHooks;

        // Call the onReady hook
        await controllerHooks.onReady();

        expect(setupWatchMock).not.toHaveBeenCalled();
      });
    });
  });
});

describe("Capability", () => {
  let capability: Capability;
  let schedule: Schedule;

  beforeEach(() => {
    capability = new Capability({
      name: "test",
      description: "test",
    });

    schedule = {
      name: "test-name",
      every: 1,
      unit: "seconds",
      run: jest.fn(),
      startTime: new Date(),
      completions: 1,
    };
  });

  describe("when handling schedules", () => {
    it("should set hasSchedule flag when OnSchedule is called", () => {
      const { OnSchedule } = capability;
      OnSchedule(schedule);
      expect(capability.hasSchedule).toBe(true);
    });
  });
});
