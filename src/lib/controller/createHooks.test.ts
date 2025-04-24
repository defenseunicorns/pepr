import { describe, beforeEach, jest, it, expect } from "@jest/globals";
import { createControllerHooks } from "./createHooks";
import * as watchProcessor from "../processors/watch-processor";
import { Capability } from "../core/capability";

const setupWatchMock = jest.spyOn(watchProcessor, "setupWatch");

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

it("should not call setupWatch when not in watch or dev mode", async () => {
  createControllerHooks(opts, capabilities, []).onReady!();
  expect(setupWatchMock).not.toHaveBeenCalled();
});

describe.each([["watch"], ["dev"]])("when running in '%s' mode", mode => {
  beforeEach(() => {
    process.env.PEPR_WATCH_MODE = mode === "watch" ? "true" : undefined;
    process.env.PEPR_MODE = mode === "dev" ? "dev" : undefined;
    jest.resetAllMocks();
  });

  it("should call setupWatch when controller is ready", async () => {
    setupWatchMock.mockImplementationOnce(() => {
      return;
    });

    createControllerHooks(opts, capabilities, ["some-namespace"]).onReady!();

    expect(setupWatchMock).toHaveBeenCalledTimes(1);
    expect(setupWatchMock).toHaveBeenCalledWith(
      capabilities,
      expect.arrayContaining(["some-namespace"]),
    );
  });

  it("should throw an error when setupWatch fails", async () => {
    setupWatchMock.mockImplementationOnce(() => {
      throw new Error("Test watch setup error");
    });

    await expect(createControllerHooks(opts, capabilities, []).onReady!()).rejects.toThrow(
      "Watch Error: Could not set up watch.",
    );

    expect(setupWatchMock).toHaveBeenCalledTimes(1);
  });
});
