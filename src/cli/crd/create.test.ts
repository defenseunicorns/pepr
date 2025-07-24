// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import create, { generateCRDScaffold } from "./create";
import { Command } from "commander";
import { promises as fs } from "fs";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";
import Log from "../../lib/telemetry/logger";

describe("generateCRDScaffold", () => {
  // Common test data
  const group = "example";
  const version = "v1alpha1";
  const kind = "MyCustomResource";
  const data = {
    domain: "example.com",
    plural: "mycustomresources",
    scope: "Namespaced",
    shortName: "mcr",
  };

  describe("when generating a CRD scaffold with valid inputs", () => {
    let result: string;

    beforeEach(() => {
      result = generateCRDScaffold(group, version, kind, data);
    });

    it("should include type definitions for spec and status", () => {
      expect(result).toContain(`${kind}Spec`);
      expect(result).toContain(`${kind}Status`);
    });

    it("should include group and version metadata as comments", () => {
      expect(result).toContain(`// Group: ${group}`);
      expect(result).toContain(`// Version: ${version}`);
    });

    it("should include domain in comments", () => {
      expect(result).toContain(`// Domain: ${data.domain}`);
    });

    it("should configure CRD metadata correctly", () => {
      expect(result).toContain(`plural: "${data.plural}"`);
      expect(result).toContain(`scope: "${data.scope}"`);
      expect(result).toContain(`shortName: "${data.shortName}"`);
    });

    it("should include status condition types", () => {
      expect(result).toContain(`${kind}StatusCondition`);
      expect(result).toContain(`${kind}Status`);
    });
  });
});

describe("create CLI command", () => {
  let program: Command;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    program = new Command();
    program.addCommand(create);
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
    const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
    const createDirSpy = createDirectoryIfNotExists as unknown as ReturnType<typeof vi.fn>;
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

    vi.mock("../../lib/telemetry/logger", () => ({
      __esModule: true,
      default: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    }));

    vi.mock("../../lib/filesystemService", () => ({
      createDirectoryIfNotExists: vi.fn().mockResolvedValue(undefined),
    }));

    beforeEach(() => vi.resetAllMocks());

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
      expect(createDirSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1"));
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/kind_types.ts"),
        expect.stringContaining("// Kind: kind"),
      );
    });
  });
});
