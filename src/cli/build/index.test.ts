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
  let stderrSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    build(program);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
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

  it.each([["-M"], ["--rbac-mode"]])(
    "should reject unsupported RBAC modes (%s) ",
    async rbacModeFlag => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      try {
        await program.parseAsync(["build", rbacModeFlag, "unsupported"], { from: "user" });
      } catch {
        expect(stderrSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /error: option .* argument .* is invalid\. Allowed choices are admin, scoped/,
          ),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    },
  );

  describe.each([
    [
      {
        option: "--custom-image",
        optionValue: "value",
        conflict: "--registry",
        conflictValue: "GitHub",
      },
    ],
    [
      {
        option: "--custom-image",
        optionValue: "value",
        conflict: "--registry-info",
        conflictValue: "value",
      },
    ],
    [
      {
        option: "--registry",
        optionValue: "Iron Bank",
        conflict: "--registry-info",
        conflictValue: "value",
      },
    ],
  ])("when conflicting options are set %j", conflictingOptions => {
    it("should exit with code 1", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      try {
        await program.parseAsync(
          [
            "build",
            conflictingOptions.option,
            conflictingOptions.optionValue,
            conflictingOptions.conflict,
            conflictingOptions.conflictValue,
          ],
          { from: "user" },
        );
      } catch {
        expect(stderrSpy).toHaveBeenCalledExactlyOnceWith(
          expect.stringContaining("cannot be used with option"),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      }
    });
  });
});

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
