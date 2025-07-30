// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import build from ".";
import { it, expect, beforeEach, describe, vi } from "vitest";
import { BuildContext, BuildOptions } from "esbuild";
import { buildModule, BuildModuleReturn } from "./buildModule";
import {
  assignImage,
  createOutputDirectory,
  generateYamlAndWriteToDisk,
  handleCustomImageBuild,
  handleValidCapabilityNames,
} from "./build.helpers";

vi.mock("./buildModule.ts", async () => {
  return {
    buildModule: vi.fn().mockResolvedValue({
      path: "some/path",
      uuid: "some-uuid",
      ctx: {} as BuildContext<BuildOptions>,
      cfg: {
        description: "some description",
        version: "some version",
        pepr: {
          uuid: "some-uuid",
          peprVersion: "some version",
          includedFiles: [],
          alwaysIgnore: {
            namespaces: [],
          },
          webhookTimeout: 30,
          rbacMode: "admin",
        },
      },
    }),
  } as unknown as BuildModuleReturn;
});

vi.mock("./build.helpers.ts", async () => {
  const actual = await vi.importActual("./build.helpers.ts");
  return {
    ...actual,
    assignImage: vi.fn().mockReturnValue("some-image"),
    createOutputDirectory: vi.fn().mockReturnValue("some-output-dir"),
    handleCustomImageBuild: vi.fn(),
    handleValidCapabilityNames: vi.fn(),
    generateYamlAndWriteToDisk: vi.fn(),
  };
});

describe("build CLI command", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    build(program);
  });

  it("should call the Build command", async () => {
    await program.parseAsync(["build"], { from: "user" });
    expect(assignImage).toBeCalled();
    expect(buildModule).toBeCalled();
    expect(createOutputDirectory).toBeCalled();
    expect(generateYamlAndWriteToDisk).toBeCalled();
    expect(handleCustomImageBuild).not.toBeCalled();
    expect(handleValidCapabilityNames).toBeCalled();
  });
  describe("when conflicting options are used", () => {
    it("should log an error and exit", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      try {
        await program.parseAsync(
          ["build", "--custom-image", "some-image", "--registry", "some-registry"],
          { from: "user" },
        );
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });
  });
});

// --custom-image AND --registry
// --custom-image AND --registry-info
// --registry AND --registry-info
// -I is not in "registry/username" format, can we validate it in .option()?
// -M is not "admin" or "scoped"
// -P Can we validate in .option()? Or do earlier in the .action()?
// When image is not ""
// When timeout it less than 0 or more than 30 seconds (see src/lib/helpers:parseTimeout())
// When validImagePullSecret passes/fails
// With and without -n for embed flag (log or not)
// Needs package.json AND pepr.ts (entrypoint)

// Mock Assets()

// Entrypoint validation for non-file input? E.g., a directory -> Could have nicer error handling, not critical
// Probably don't want to use PEPR_CUSTOM_BUILD_NAME envar
// Use Log for logging instead of console
