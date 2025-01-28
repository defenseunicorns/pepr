// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, expect, jest, test, describe } from "@jest/globals";
import { clone } from "ramda";
import { Capability } from "./capability";
import { Schedule } from "./schedule";
import { PackageJSON, PeprModule } from "./module";
import { CapabilityExport } from "../types";
import { OnError } from "../../cli/init/enums";

// Mock Controller
const startServerMock = jest.fn();
jest.mock("../controller", () => {
  return {
    Controller: jest.fn().mockImplementation(() => {
      return { startServer: startServerMock };
    }),
  };
});

// Reset the mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock PackageJSON
const packageJSON: PackageJSON = {
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

test("should instantiate Controller and start it with the default port", () => {
  new PeprModule(packageJSON);
  expect(startServerMock).toHaveBeenCalledWith(3000);
});

test("should instantiate Controller and start it with the specified port", () => {
  const module = new PeprModule(packageJSON, [], { deferStart: true });
  const port = Math.floor(Math.random() * 10000) + 1000;
  module.start(port);
  expect(startServerMock).toHaveBeenCalledWith(port);
});

test("should not start if deferStart is true", () => {
  new PeprModule(packageJSON, [], { deferStart: true });
  expect(startServerMock).not.toHaveBeenCalled();
});

test("should reject invalid pepr onError conditions", () => {
  const cfg = clone(packageJSON);
  cfg.pepr.onError = "invalidError";
  expect(() => new PeprModule(cfg)).toThrow();
});

test("should allow valid pepr onError conditions", () => {
  const cfg = clone(packageJSON);
  cfg.pepr.onError = OnError.AUDIT;
  expect(() => new PeprModule(cfg)).not.toThrow();

  cfg.pepr.onError = OnError.IGNORE;
  expect(() => new PeprModule(cfg)).not.toThrow();

  cfg.pepr.onError = OnError.REJECT;
  expect(() => new PeprModule(cfg)).not.toThrow();
});

test("should not create a controller if PEPR_MODE is set to build", () => {
  process.env.PEPR_MODE = "build";
  new PeprModule(packageJSON);
  expect(startServerMock).not.toHaveBeenCalled();
});

test("should send the capabilities to the parent process if PEPR_MODE is set to build", () => {
  const sendMock = jest.spyOn(process, "send").mockImplementation(() => true);
  process.env.PEPR_MODE = "build";

  const capability = new Capability({
    name: "test",
    description: "test",
  });

  const expected: CapabilityExport = {
    name: capability.name,
    description: capability.description,
    namespaces: capability.namespaces,
    bindings: capability.bindings,
    hasSchedule: capability.hasSchedule,
  };

  new PeprModule(packageJSON, [capability]);
  expect(sendMock).toHaveBeenCalledWith([expected]);
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

  test("should handle OnSchedule", () => {
    const { OnSchedule } = capability;
    OnSchedule(schedule);
    expect(capability.hasSchedule).toBe(true);
  });
});
