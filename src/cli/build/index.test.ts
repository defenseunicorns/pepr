// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import build from ".";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
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

  it("should call the Build command with default values", async () => {
    await program.parseAsync(["build"], { from: "user" });
    expect(assignImage).toHaveBeenCalledWith(expect.objectContaining({ customImage: undefined })); // This isn't the default?
    expect(buildModule).toBeCalled();
    expect(createOutputDirectory).toBeCalled();
    expect(generateYamlAndWriteToDisk).toBeCalled();
    expect(handleCustomImageBuild).not.toBeCalled();
    expect(handleValidCapabilityNames).toBeCalled();
    expect(process.env.PEPR_CUSTOM_BUILD_NAME).toBeUndefined();
  });

  describe.each([["-c"], ["--custom-name"]])(
    "when the custom name flag is set (%s)",
    customNameFlag => {
      it("should set the PEPR_CUSTOM_BUILD_NAME envar", async () => {
        await program.parseAsync(["build", customNameFlag, "name"], {
          from: "user",
        });
        expect(process.env.PEPR_CUSTOM_BUILD_NAME).toBe("name");
      });
    },
  );

  describe.each([["-I"], ["--registry-info"]])(
    "when the registry info flag is set (%s)",
    registryInfoFlag => {
      // Does this actually do anything??
      it("should include zero additional files in build", async () => {
        vi.spyOn(console, "info").mockImplementation(() => {});
        await program.parseAsync(["build", registryInfoFlag, "organization/username"], {
          from: "user",
        });
        expect(assignImage).toHaveBeenCalledWith(
          expect.objectContaining({
            customImage: undefined,
            registryInfo: "organization/username",
          }),
        );
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toBeCalled();
        expect(handleCustomImageBuild).toBeCalled();
        expect(handleValidCapabilityNames).toBeCalled();
        expect(console.info).toHaveBeenCalledWith(
          expect.stringContaining("Including 0 files in controller image."),
        );
      });
    },
  );

  describe.each([["-P"], ["--with-pull-secret"]])(
    "when the with pull secret flag is set (%s)",
    withPullSecretFlag => {
      it("should do something", async () => {
        await program.parseAsync(["build", withPullSecretFlag, "secret"], { from: "user" });
        expect(assignImage).toHaveBeenCalledWith(
          expect.objectContaining({ customImage: undefined }),
        );
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toHaveBeenCalledWith(
          expect.objectContaining({ imagePullSecret: "secret" }),
        );
        expect(handleCustomImageBuild).not.toBeCalled();
        expect(handleValidCapabilityNames).toBeCalled();
      });
      it.each(["#secret", "@secret", "!secret"])(
        "reject an invalid pull secret (%s)",
        async invalidSecret => {
          const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
          await expect(
            program.parseAsync(["build", withPullSecretFlag, invalidSecret], { from: "user" }),
          ).rejects.toThrowError('process.exit unexpectedly called with "1"');
          expect(stderrSpy).toHaveBeenCalledWith(
            "Invalid imagePullSecret. Please provide a valid name as defined in RFC 1123.",
          );
        },
      );
    },
  );

  describe.each([["-n"], ["--no-embed"]])("when the no embed flag is set (%s)", noEmbedFlag => {
    it("should exit after building", async () => {
      vi.spyOn(console, "info").mockImplementation(() => {});
      await program.parseAsync(["build", noEmbedFlag], { from: "user" });
      expect(assignImage).toHaveBeenCalledWith(expect.objectContaining({ customImage: undefined }));
      expect(buildModule).toBeCalled();
      expect(createOutputDirectory).toBeCalled();
      expect(generateYamlAndWriteToDisk).not.toBeCalled();
      expect(handleCustomImageBuild).not.toBeCalled();
      expect(handleValidCapabilityNames).not.toBeCalled();
      expect(console.info).toHaveBeenCalledWith("Module built successfully at some/path");
    });
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

  describe.each([["-e"], ["--entry-point"]])(
    "when the entry point flag is set (%s)",
    entryPointFlag => {
      it("should attempt to build the module", async () => {
        await program.parseAsync(["build", entryPointFlag, "pepr.ts"], { from: "user" });
        expect(buildModule).toBeCalled();
      });
      it("should require a value", async () => {
        try {
          await program.parseAsync(["build", entryPointFlag], { from: "user" });
        } catch {
          expectMissingArgument(stderrSpy);
        }
      });
    },
  );

  describe.each([["-o"], ["--output"]])("when the output flag is set (%s)", outputFlag => {
    it("should create the output directory", async () => {
      await program.parseAsync(["build", outputFlag, "some-directory"], { from: "user" });
      expect(createOutputDirectory).toBeCalled();
    });

    it("should require a value", async () => {
      try {
        await program.parseAsync(["build", outputFlag], { from: "user" });
      } catch {
        expectMissingArgument(stderrSpy);
      }
    });
  });

  const flagTestCases = [
    {
      name: "registry",
      shortFlag: "-r",
      longFlag: "--registry",
      validOptions: ["GitHub", "Iron Bank"],
      invalidCaseOptions: ["github", "iron bank"],
      rejectLowerCase: true,
    },
    {
      name: "rbac-mode",
      shortFlag: "-M",
      longFlag: "--rbac-mode",
      validOptions: ["admin", "scoped"],
      exitOnInvalid: true,
    },
    {
      name: "zarf",
      shortFlag: "-z",
      longFlag: "--zarf",
      validOptions: ["manifest", "chart"],
    },
  ];

  describe.each(flagTestCases)(
    "when the $name flag is set",
    ({
      name,
      shortFlag,
      longFlag,
      validOptions,
      invalidCaseOptions,
      rejectLowerCase,
      exitOnInvalid,
    }) => {
      describe.each([{ flag: shortFlag }, { flag: longFlag }])("$flag", ({ flag }) => {
        it.each(validOptions.map(opt => [opt]))(
          `should allow '%s' as the ${name} value`,
          async validOption => {
            await program.parseAsync(["build", flag, validOption], { from: "user" });
            expect(generateYamlAndWriteToDisk).toBeCalled();
          },
        );

        it("should require a value", async () => {
          try {
            await program.parseAsync(["build", flag], { from: "user" });
          } catch {
            expectMissingArgument(stderrSpy);
          }
        });

        it(`should reject unsupported ${name} values`, async () => {
          let exitSpy;
          if (exitOnInvalid) {
            exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
              throw new Error("process.exit called");
            });
          }
          try {
            await program.parseAsync(["build", flag, "unsupported"], { from: "user" });
          } catch {
            expectInvalidOption(stderrSpy, validOptions);
            if (exitOnInvalid) {
              expect(exitSpy).toHaveBeenCalledWith(1);
            }
          }
        });

        if (rejectLowerCase && invalidCaseOptions) {
          it.each(invalidCaseOptions.map(opt => [opt]))(
            "should reject lower-case values ('%s')",
            async invalidCase => {
              try {
                await program.parseAsync(["build", flag, invalidCase], { from: "user" });
              } catch {
                expectInvalidOption(stderrSpy, validOptions);
              }
            },
          );
        }
      });
    },
  );

  const conflictingOptions = [
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
  ];
  describe.each(conflictingOptions)(
    "when $option and $conflict are set",
    ({ option, optionValue, conflict, conflictValue }) => {
      it("should exit with code 1", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
          throw new Error("process.exit called");
        });
        try {
          await program.parseAsync(["build", option, optionValue, conflict, conflictValue], {
            from: "user",
          });
        } catch {
          expect(stderrSpy).toHaveBeenCalledExactlyOnceWith(
            expect.stringContaining("cannot be used with option"),
          );
          expect(exitSpy).toHaveBeenCalledWith(1);
        }
      });
    },
  );
  const expectInvalidOption = (outputSpy: MockInstance, options: string[]) => {
    expect(outputSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `error: option .* argument .* is invalid. Allowed choices are ${options.join(", ")}.`,
        ),
      ),
    );
  };
  const expectMissingArgument = (outputSpy: MockInstance) => {
    expect(outputSpy).toHaveBeenCalledWith(
      expect.stringMatching(/error: option .* argument missing/),
    );
  };
});

// -I is not in "registry/username" format, can we validate it in .option()? We don't validate it at all
// -P Can we validate in .option()? Or do earlier in the .action()?
// When validImagePullSecret passes/fails
// Needs package.json AND pepr.ts (entrypoint)

// Mock Assets()

// Entrypoint validation for non-file input? E.g., a directory -> Could have nicer error handling, not critical
// Probably don't want to use PEPR_CUSTOM_BUILD_NAME envar
// Use Log for logging instead of console
