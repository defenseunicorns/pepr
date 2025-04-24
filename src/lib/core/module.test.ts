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

// Mock Controller
const startServerMock = jest.fn();
jest.mock("../controller", () => ({
  Controller: jest.fn().mockImplementation(() => ({
    startServer: startServerMock,
  })),
}));

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
