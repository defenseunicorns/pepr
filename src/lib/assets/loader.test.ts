// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect, beforeEach, jest, afterEach } from "@jest/globals";
import { CapabilityExport } from "../types";
import { loadCapabilities } from "./loader";
import { fork } from "child_process";

jest.mock("child_process", () => ({
  fork: jest.fn(),
}));

describe("loadCapabilities", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProcess: any;

  beforeEach(() => {
    mockProcess = {
      on: jest.fn(),
      send: jest.fn(),
    };

    (fork as jest.Mock).mockReturnValue(mockProcess);
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should resolve the capabilities array when the forked process sends message", async () => {
    const mockCapabilities: CapabilityExport[] = [
      {
        name: "TestCapability1",
        description: "Test Description 1",
        bindings: [],
        hasSchedule: false,
      },
      {
        name: "TestCapability2",
        description: "Test Description 2",
        bindings: [],
        hasSchedule: false,
      },
    ];

    setTimeout(() => {
      const messageHandler = mockProcess.on.mock.calls.find(
        (call: [string, [(message: CapabilityExport[]) => void]]) => call[0] === "message",
      )?.[1];

      if (messageHandler) {
        messageHandler(mockCapabilities);
      }
    }, 10);

    const result = await loadCapabilities("/fake/path");

    expect(result).toEqual(mockCapabilities);
    expect(console.info).toHaveBeenCalledWith('Registered Pepr Capability "TestCapability1"');
    expect(console.info).toHaveBeenCalledWith('Registered Pepr Capability "TestCapability2"');
  });

  it("should reject with an error when the process encounters an error", async () => {
    const mockError = new Error("Process failed");

    setTimeout(() => {
      mockProcess.on.mock.calls.find(
        (call: [string, [(error: Error) => void]]) => call[0] === "error",
      )?.[1]?.(mockError);
    }, 10);

    await expect(loadCapabilities("/fake/path")).rejects.toThrow("Process failed");
  });

  it("should call fork with the correct environment variables", async () => {
    try {
      void loadCapabilities("/fake/path");
    } catch {
      // Do nothing
    }

    expect(fork).toHaveBeenCalledWith("/fake/path", {
      env: expect.objectContaining({
        LOG_LEVEL: "warn",
        PEPR_MODE: "build",
        NODE_OPTIONS: "--disable-warning=DEP0040",
      }),
    });
  });
});
