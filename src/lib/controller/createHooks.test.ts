import { describe, beforeEach, vi, it, expect } from "vitest";
import { createControllerHooks } from "./createHooks";
import * as watchProcessor from "../processors/watch-processor";
import { Capability } from "../core/capability";

const setupWatchMock = vi.spyOn(watchProcessor, "setupWatch");

const capabilities = [
  new Capability({
    name: "test-capability",
    description: "test capability for hooks",
  }),
];

const opts = {
  beforeHook: vi.fn(),
  afterHook: vi.fn(),
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
    vi.resetAllMocks();
  });

  describe("when ignored namespaces are not provided", () => {
    it("should include all namespaces", async () => {
      createControllerHooks(opts, capabilities).onReady!();
      expect(setupWatchMock).toHaveBeenCalledWith(capabilities, []);
    });
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
      "WatchError: Could not set up watch.",
    );

    expect(setupWatchMock).toHaveBeenCalledTimes(1);
  });
});
