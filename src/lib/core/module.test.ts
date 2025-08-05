// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, expect, vi, it, describe, afterEach } from "vitest";
import { clone } from "ramda";
import { Capability } from "./capability";
import { Schedule } from "./schedule";
import { PeprModule } from "./module";
import { PackageJSON } from "../types";
import { CapabilityExport } from "../types";
import { OnError } from "../../cli/init/enums";
import Log from "../telemetry/logger";

// Mock Controller
const startServerMock = vi.fn();
vi.mock("../controller", () => ({
  Controller: vi.fn().mockImplementation(() => ({
    startServer: startServerMock,
  })),
}));

vi.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    debug: vi.fn(),
  },
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
  const mockPkgJSON = clone(mockPackageJSON);
  mockPkgJSON.pepr.alwaysIgnore = {
    namespaces: ["kube-system", "kube-public"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PEPR_MODE;
    delete process.env.PEPR_WATCH_MODE;
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

  describe("when running in 'build' mode", () => {
    beforeEach(() => {
      process.send = vi.fn();
    });

    afterEach(() => {
      delete process.send;
    });

    beforeEach(() => {
      process.env.PEPR_MODE = "build";
    });

    afterEach(() => {
      vi.resetAllMocks();
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
      process.send = vi.fn();
      const sendMock = vi.spyOn(process, "send");
      new PeprModule(mockPackageJSON, [capability]);
      expect(Log.debug).toHaveBeenCalledWith("Capability test registered");
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
      run: vi.fn(),
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
