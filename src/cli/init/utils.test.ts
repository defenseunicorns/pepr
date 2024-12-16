// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, jest, describe, afterEach } from "@jest/globals";
import { promises as fs } from "fs";
import { sanitizeName, createDir, write } from "./utils";

jest.mock("fs", () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

it.each([
  //Test sanitizeName() with ["$BAD_INPUT", "$SANITIZED_INPUT"]
  ["My Test Module", "my-test-module"],
  ["!! 123 @@ Module", "123-module"],
  ["---Test-Module---", "test-module"],
])("sanitizeName() sanitizes '%s' correctly", (input: string, expected: string) => {
  expect(sanitizeName(input)).toBe(expected);
});

it("sanitizeName() should throw TypeError when given a non-string", () => {
  expect(() => sanitizeName({ input: 0 } as unknown as string)).toThrow(TypeError);
});

describe("createDir", () => {
  const mockedMkdir = fs.mkdir as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks between tests
  });

  it("should create the pepr-test-module dir", async () => {
    await createDir("pepr-test-module");
    expect(mockedMkdir).toHaveBeenCalledWith("pepr-test-module");
  });

  it("should throw an error if the directory already exists", async () => {
    const error = new Error("Directory already exists") as NodeJS.ErrnoException;
    error.code = "EEXIST";
    mockedMkdir.mockRejectedValueOnce(error as unknown as never);

    await expect(createDir("pepr-test-module")).rejects.toThrow(
      "Directory pepr-test-module already exists",
    );
    expect(mockedMkdir).toHaveBeenCalledTimes(1);
    expect(mockedMkdir).toHaveBeenCalledWith("pepr-test-module");
  });

  it("should throw the error if there is another error other than already exists", async () => {
    const error = new Error("Directory already exists") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    mockedMkdir.mockRejectedValueOnce(error as unknown as never);

    await expect(createDir("pepr-test-module")).rejects.toThrow(error);
    expect(mockedMkdir).toHaveBeenCalledTimes(1);
    expect(mockedMkdir).toHaveBeenCalledWith("pepr-test-module");
  });
});

describe("write", () => {
  const mockedWriteFile = fs.writeFile as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should write data to a file", async () => {
    await write("package.json", "pepr-test-module");
    expect(mockedWriteFile).toHaveBeenCalledWith("package.json", "pepr-test-module");
  });

  it("should stringify data if it is not a string", async () => {
    await write("package.json", { name: "pepr-test-module" });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      "package.json",
      JSON.stringify({ name: "pepr-test-module" }, null, 2),
    );
  });
});
