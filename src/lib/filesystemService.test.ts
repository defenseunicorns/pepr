// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, vi, expect, it, type Mock } from "vitest";
import { createDirectoryIfNotExists } from "./filesystemService";
import { promises as fs } from "fs";

vi.mock("fs", () => {
  return {
    promises: {
      access: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

describe("createDirectoryIfNotExists function", () => {
  it("should create a directory if it doesn't exist", async () => {
    (fs.access as Mock).mockRejectedValue({ code: "ENOENT" } as never);
    (fs.mkdir as Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).toHaveBeenCalledWith(directoryPath, { recursive: true });
  });

  it("should not create a directory if it already exists", async () => {
    vi.resetAllMocks();
    (fs.access as Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it("should throw an error for other fs.access errors", async () => {
    vi.resetAllMocks();
    (fs.access as Mock).mockRejectedValue({ code: "ERROR" } as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    try {
      await createDirectoryIfNotExists(directoryPath);
    } catch (error) {
      expect(error.code).toEqual("ERROR");
    }
  });
});
