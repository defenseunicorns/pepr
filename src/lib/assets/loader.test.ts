// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect, beforeEach, vi, afterEach } from "vitest";
import { CapabilityExport } from "../types";
import { loadCapabilities } from "./loader";
import { fork } from "child_process";

vi.mock("child_process", () => ({
  fork: vi.fn(),
}));

describe("loadCapabilities", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProcess: any;

  beforeEach(() => {
    mockProcess = {
      on: vi.fn(),
      send: vi.fn(),
    };
    (fork as vi.Mock).mockReturnValue(mockProcess);
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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

  // loadCapabilities promise never resolves if child exits without sending a
  // message. We listen on "close" (not "exit") because "close" fires after all
  // IPC/stdio streams are drained, guaranteeing any pending process.send() from
  // the child has been delivered as a "message" event first.
  it("should reject when the child process closes without sending a message", async () => {
    setTimeout(() => {
      const closeHandler = mockProcess.on.mock.calls.find(
        (call: [string, (code: number | null) => void]) => call[0] === "close",
      )?.[1];

      if (closeHandler) {
        closeHandler(1);
      }
    }, 10);

    await expect(loadCapabilities("/fake/path")).rejects.toThrow(
      "Child process exited with code 1 before sending capabilities",
    );
  });

  it("should include the signal name when the child is killed", async () => {
    setTimeout(() => {
      const closeHandler = mockProcess.on.mock.calls.find(
        (call: [string, (code: number | null, signal: string | null) => void]) =>
          call[0] === "close",
      )?.[1];

      if (closeHandler) {
        closeHandler(null, "SIGTERM");
      }
    }, 10);

    await expect(loadCapabilities("/fake/path")).rejects.toThrow(
      "Child process exited with signal SIGTERM before sending capabilities",
    );
  });

  it("should not reject on close if message was already received", async () => {
    setTimeout(() => {
      const messageHandler = mockProcess.on.mock.calls.find(
        (call: [string, [(message: CapabilityExport[]) => void]]) => call[0] === "message",
      )?.[1];
      const closeHandler = mockProcess.on.mock.calls.find(
        (call: [string, (code: number | null) => void]) => call[0] === "close",
      )?.[1];

      // Message arrives first, then close — close should be a no-op.
      if (messageHandler) {
        messageHandler([{ name: "Cap", description: "d", bindings: [], hasSchedule: false }]);
      }
      if (closeHandler) {
        closeHandler(0);
      }
    }, 10);

    const result = await loadCapabilities("/fake/path");
    expect(result).toEqual([{ name: "Cap", description: "d", bindings: [], hasSchedule: false }]);
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
