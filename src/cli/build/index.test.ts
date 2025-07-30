// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import build from ".";
import { it, expect, beforeEach, describe, vi } from "vitest";
import { BuildContext, BuildOptions } from "esbuild";
import { buildModule, BuildModuleReturn } from "./buildModule";
// Import the module itself for spying
import * as buildHelpers from "./build.helpers";
// Destructure for convenience in the rest of the code
import {
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

const assignImage = vi.spyOn(buildHelpers, "assignImage");

vi.mock("./build.helpers.ts", async () => {
  const actual = await vi.importActual("./build.helpers.ts");
  return {
    ...actual,
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
    expect(assignImage).toHaveBeenCalledWith(expect.objectContaining({ customImage: undefined })); // This isn't the default?
    expect(buildModule).toBeCalled();
    expect(createOutputDirectory).toBeCalled();
    expect(generateYamlAndWriteToDisk).toBeCalled();
    expect(handleCustomImageBuild).not.toBeCalled();
    expect(handleValidCapabilityNames).toBeCalled();
  });

  describe.each([["-i"], ["--custom-image"]])(
    "when the custom image flag is set (%s)",
    customImageFlag => {
      it.each([["some-image"]])("should set the image to '%s'", async image => {
        await program.parseAsync(["build", customImageFlag, image], { from: "user" });
        expect(assignImage).toHaveBeenCalledWith(expect.objectContaining({ customImage: image }));
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toBeCalled();
        expect(handleCustomImageBuild).not.toBeCalled();
        expect(handleValidCapabilityNames).toBeCalled();
      });

      // Is there such a thing as image validation?
    },
  );
  // Wrap in a describe block for how to use flag?
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

  describe.each(["--timeout", "-t"])("when the timeout flag is set (%s)", timeoutFlag => {
    it("should accept a timeout in the supported range", async () => {
      await program.parseAsync(["build", timeoutFlag, "10"], { from: "user" });
      expect(assignImage).toBeCalled();
      expect(buildModule).toBeCalled();
      expect(createOutputDirectory).toBeCalled();
      expect(generateYamlAndWriteToDisk).toBeCalled();
      expect(handleCustomImageBuild).not.toBeCalled();
      expect(handleValidCapabilityNames).toBeCalled();
    });
    it.each([["-1"], ["31"]])(
      "should reject timeouts outside of the supported range (%s)",
      async invalidTimeout => {
        await expect(
          program.parseAsync(["build", timeoutFlag, invalidTimeout], { from: "user" }),
        ).rejects.toThrowError("Number must be between 1 and 30.");
      },
    );

    it("should reject non-numeric timeouts", async () => {
      await expect(
        program.parseAsync(["build", timeoutFlag, "not-a-number"], { from: "user" }),
      ).rejects.toThrowError("Not a number.");
    });
    it("should reject float timeouts", async () => {
      await expect(
        program.parseAsync(["build", timeoutFlag, "5.2"], { from: "user" }),
      ).rejects.toThrowError("Value must be an integer.");
    });
    // it("should reject float timeouts", async () => {
    //   await expect(program.parseAsync(["build", timeoutFlag, "5.0"], { from: "user" })).rejects.toThrowError("Value must be an integer.")
    // });
  });

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
// -P Can we validate in .option()? Or do earlier in the .action()?
// When validImagePullSecret passes/fails
// With and without -n for embed flag (log or not)
// Needs package.json AND pepr.ts (entrypoint)

// Mock Assets()

// Entrypoint validation for non-file input? E.g., a directory -> Could have nicer error handling, not critical
// Probably don't want to use PEPR_CUSTOM_BUILD_NAME envar
// Use Log for logging instead of console
