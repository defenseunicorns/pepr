// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, jest, expect, it } from "@jest/globals";
import { createDirectoryIfNotExists } from "./filesystemService";
import { promises as fs } from "fs";

jest.mock("fs", () => {
  return {
    promises: {
      access: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});

describe("createDirectoryIfNotExists function", () => {
  it("should create a directory if it doesn't exist", async () => {
    (fs.access as jest.Mock).mockRejectedValue({ code: "ENOENT" } as never);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).toHaveBeenCalledWith(directoryPath, { recursive: true });
  });

  it("should not create a directory if it already exists", async () => {
    jest.resetAllMocks();
    (fs.access as jest.Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it("should throw an error for other fs.access errors", async () => {
    jest.resetAllMocks();
    (fs.access as jest.Mock).mockRejectedValue({ code: "ERROR" } as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    try {
      await createDirectoryIfNotExists(directoryPath);
    } catch (error) {
      expect(error.code).toEqual("ERROR");
    }
  });
});
