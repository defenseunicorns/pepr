// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import anyTest from "ava";
import { clone } from "ramda";
import sinon from "sinon";

import { Capability } from "./capability";
import { Controller } from "./controller";
import { Errors } from "./errors";
import { PackageJSON, PeprModule } from "./module";
import { CapabilityExport } from "./types";

// Mocks rely on the test being serial
const test = anyTest.serial;
const controllerMock = sinon.stub(Controller.prototype);

// Reset the mocks before each test
test.beforeEach(() => {
  sinon.reset();
});

// Mock PackageJSON
const packageJSON: PackageJSON = {
  description: "Test Description",
  pepr: {
    name: "Development Module",
    uuid: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
    description: "Development module for pepr",
    onError: "ignore",
    alwaysIgnore: {
      namespaces: [],
      labels: [],
    },
  },
};

test("should instantiate Controller and start it with the default port", t => {
  new PeprModule(packageJSON);

  // Verify that startServer was called with default port 3000
  t.deepEqual(controllerMock.startServer.firstCall.args[0], 3000);
});

test("should instantiate Controller and start it with the specified port", t => {
  const module = new PeprModule(packageJSON, [], { deferStart: true });

  // Start the module with port a random port
  const port = Math.floor(Math.random() * 10000) + 1000;
  module.start(port);

  // Verify that startServer was called with the specified port
  t.deepEqual(controllerMock.startServer.firstCall.args[0], port);
});

test("should not start if deferStart is true", t => {
  new PeprModule(packageJSON, [], { deferStart: true });

  // Verify that startServer was never called
  t.false(controllerMock.startServer.called);
});

test("should reject invalid pepr onError conditions", t => {
  t.throws(() => {
    const cfg = clone(packageJSON);
    cfg.pepr.onError = "invalidError";
    new PeprModule(cfg);
  });
});

test("should allow valid pepr onError conditions", t => {
  const cfg = clone(packageJSON);
  t.notThrows(() => {
    cfg.pepr.onError = Errors.audit;
    new PeprModule(cfg);

    cfg.pepr.onError = Errors.ignore;
    new PeprModule(cfg);

    cfg.pepr.onError = Errors.reject;
    new PeprModule(cfg);
  });
});

test("should not create a controller if PEPR_MODE is set to build", t => {
  // Mock process.send
  process.send = () => true;
  process.env.PEPR_MODE = "build";

  new PeprModule(packageJSON);

  // Verify that startServer was never called
  t.false(controllerMock.startServer.called);
});

test("should send the capabilities to the parent process if PEPR_MODE is set to build", t => {
  // Mock process.send
  process.send = () => true;
  const sendStub = sinon.stub(process, "send").returns(true);
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
  };

  new PeprModule(packageJSON, [capability]);

  // Verify that the capabilities were sent back to the parent process
  t.deepEqual(sendStub.firstCall.args[0], [expected]);
});
