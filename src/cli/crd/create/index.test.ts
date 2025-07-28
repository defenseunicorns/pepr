// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "../../../lib/telemetry/logger";
import create from "./index";
import type { MockInstance } from "vitest";
import { Command } from "commander";
import { createDirectoryIfNotExists } from "../../../lib/filesystemService";
import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("../../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../lib/filesystemService", () => ({
  createDirectoryIfNotExists: vi.fn().mockResolvedValue(undefined),
}));

describe("create CLI command", () => {
  let program: Command;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    program = new Command();
    program.addCommand(create());
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("requires the group flag", async () => {
    const args = ["create"];
    await expect(program.parseAsync(args, { from: "user" })).rejects.toThrowError(
      'process.exit unexpectedly called with "1"',
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      "error: required option '-g, --group <group>' not specified\n",
    );
  });
  it("requires the kind flag", async () => {
    const args = ["create", "--group", "group"];
    await expect(program.parseAsync(args, { from: "user" })).rejects.toThrowError(
      'process.exit unexpectedly called with "1"',
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      "error: required option '-k, --kind <kind>' not specified\n",
    );
  });

  it("requires the version flag", async () => {
    const args = ["create", "--group", "group", "--kind", "kind", "--short-name", "sn"];
    await expect(program.parseAsync(args, { from: "user" })).rejects.toThrowError(
      'process.exit unexpectedly called with "1"',
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      "error: required option '-v, --version <version>' not specified\n",
    );
  });

  it("requires the short-name flag", async () => {
    const args = ["create", "--group", "group", "--kind", "kind", "--version", "version"];
    await expect(program.parseAsync(args, { from: "user" })).rejects.toThrowError(
      'process.exit unexpectedly called with "1"',
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      "error: required option '-s, --short-name <name>' not specified\n",
    );
  });

  describe("when required options are present", () => {
    const args = [
      "create",
      "--group",
      "group",
      "--kind",
      "kind",
      "--short-name",
      "sn",
      "--version",
      "v1",
    ];

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should warn that crd features are in alpha", async () => {
      await program.parseAsync(args, {
        from: "user",
      });
      expect(Log.warn).toHaveBeenCalledWith("This feature is currently in alpha.");
    });

    it("should print the location of created files", async () => {
      await program.parseAsync(args, {
        from: "user",
      });
      expect(Log.info).toHaveBeenCalledWith(
        expect.stringContaining("✔ Created kind TypeScript definition in"),
      );
      expect(Log.info).toHaveBeenCalledWith(expect.stringContaining("/api/v1"));
    });

    it("should write files to /api/<version>", async () => {
      await program.parseAsync(args, {
        from: "user",
      });
      expect(createDirectoryIfNotExists).toHaveBeenCalledWith(expect.stringContaining("/api/v1"));
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/kind_types.ts"),
        expect.stringContaining("// Kind: kind"),
      );
    });
  });
});
