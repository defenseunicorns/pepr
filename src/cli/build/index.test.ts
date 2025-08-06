// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import build from ".";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
import { BuildContext, BuildOptions } from "esbuild";
import { buildModule, BuildModuleReturn } from "./buildModule";
import {
  createOutputDirectory,
  generateYamlAndWriteToDisk,
  handleCustomImageBuild,
} from "./build.helpers";
import Log from "../../lib/telemetry/logger";

vi.mock("../../lib/tls.ts", async () => {
  return {
    ...vi.importActual("../../lib/tls.ts"),
    genTLS: vi.fn().mockImplementation(() => {
      return {
        ca: "some-ca",
        crt: "some-crt",
        key: "some-key",
        pem: {
          ca: "some-ca",
          crt: "some-crt",
          key: "some-key",
        },
      };
    }),
  };
});

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
    createOutputDirectory: vi.fn().mockReturnValue("some-output-dir"),
    handleCustomImageBuild: vi.fn(),
    generateYamlAndWriteToDisk: vi.fn(),
  };
});

vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
  },
}));

describe("build CLI command", () => {
  let program: Command;
  let stderrSpy;
  let exitSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    build(program);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit");
  });

  it("should call the Build command with default values", async () => {
    await runProgramWithArgs([]);
    expect(buildModule).toBeCalled();
    expect(createOutputDirectory).toBeCalled();
    expect(generateYamlAndWriteToDisk).toBeCalled();
    expect(handleCustomImageBuild).not.toBeCalled();

    expect(process.env.PEPR_CUSTOM_BUILD_NAME).toBeUndefined();
  });

  type CommonTestCase = {
    name: string;
    shortFlag: string;
    longFlag: string;
    enumValues?: string[];
    invalidEnumValues?: string[];
  };

  const flagTestCases: CommonTestCase[] = [
    {
      name: "output",
      shortFlag: "-o",
      longFlag: "--output",
    },
    {
      name: "entry point",
      shortFlag: "-e",
      longFlag: "--entry-point",
    },
    {
      name: "registry",
      shortFlag: "-r",
      longFlag: "--registry",
      enumValues: ["GitHub", "Iron Bank"],
      invalidEnumValues: ["github", "iron bank"],
    },
    {
      name: "rbac-mode",
      shortFlag: "-M",
      longFlag: "--rbac-mode",
      enumValues: ["admin", "scoped"],
      invalidEnumValues: [],
    },
    {
      name: "zarf",
      shortFlag: "-z",
      longFlag: "--zarf",
      enumValues: ["manifest", "chart"],
      invalidEnumValues: [],
    },
  ];

  describe.each(flagTestCases)(
    "when options accept user-input",
    ({ name, shortFlag, longFlag }) => {
      describe.each([
        { name, flag: shortFlag },
        { name, flag: longFlag },
      ])("$name via $flag", ({ flag }) => {
        it("should require a value", async () => {
          await runProgramWithError([flag]);
          expectMissingArgument(stderrSpy);
        });
      });
    },
  );

  describe.each(flagTestCases.filter(testCase => testCase.invalidEnumValues !== undefined))(
    "when options are enumerated",
    ({ name, shortFlag, longFlag, enumValues, invalidEnumValues }) => {
      describe.each([
        { name, flag: shortFlag },
        { name, flag: longFlag },
      ])("$name via $flag", ({ flag }) => {
        it.each(enumValues?.map(opt => [opt]) ?? [])(
          `should accept '%s' as the ${name} value`,
          async validOption => {
            await runProgramWithArgs([flag, validOption]);
            expect(generateYamlAndWriteToDisk).toBeCalled();
          },
        );

        if (enumValues && invalidEnumValues)
          it.each([
            ["unsupported"],
            ...invalidEnumValues.map(invalidOpt => [invalidOpt] as string[]),
          ])(`should reject unsupported ${name} values ('%s')`, async invalidInput => {
            await runProgramWithError([flag, invalidInput]);
            expectInvalidOption(stderrSpy, enumValues);
            expect(exitSpy).toHaveBeenCalledWith(1);
          });
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
    "when options conflict ($option and $conflict)",
    ({ option, optionValue, conflict, conflictValue }) => {
      it("should exit with code 1", async () => {
        await runProgramWithError([option, optionValue, conflict, conflictValue]);
        expect(stderrSpy).toHaveBeenCalledExactlyOnceWith(
          expect.stringMatching(/error: option .* cannot be used with option .*/),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
    },
  );

  describe.each([["-c"], ["--custom-name"]])(
    "when the custom name flag is set (%s)",
    customNameFlag => {
      it("should set the PEPR_CUSTOM_BUILD_NAME envar", async () => {
        await runProgramWithArgs([customNameFlag, "name"]);
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
        await runProgramWithArgs([registryInfoFlag, "organization/username"]);
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toBeCalled();
        expect(handleCustomImageBuild).toBeCalled();

        expect(Log.info).toHaveBeenCalledWith(
          expect.stringContaining("Including 0 files in controller image."),
        );
      });
    },
  );

  describe.each([["-P"], ["--with-pull-secret"]])(
    "when the with pull secret flag is set (%s)",
    withPullSecretFlag => {
      it("should do something", async () => {
        await runProgramWithArgs([withPullSecretFlag, "secret"]);
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toHaveBeenCalledWith(
          expect.objectContaining({ imagePullSecret: "secret" }),
        );
        expect(handleCustomImageBuild).not.toBeCalled();
      });
      it.each(["#secret", "@secret", "!secret"])(
        "reject an invalid pull secret (%s)",
        async invalidSecret => {
          await runProgramWithError(
            [withPullSecretFlag, invalidSecret],
            "Invalid imagePullSecret. Please provide a valid name as defined in RFC 1123.",
          );
        },
      );
    },
  );

  describe.each([["-n"], ["--no-embed"]])("when the no embed flag is set (%s)", noEmbedFlag => {
    it("should exit after building", async () => {
      vi.spyOn(console, "info").mockImplementation(() => {});
      await runProgramWithArgs([noEmbedFlag]);
      expect(buildModule).toBeCalled();
      expect(createOutputDirectory).toBeCalled();
      expect(generateYamlAndWriteToDisk).not.toBeCalled();
      expect(handleCustomImageBuild).not.toBeCalled();
      expect(Log.info).toHaveBeenCalledWith("Module built successfully at some/path");
    });
  });
  describe.each([["-i"], ["--custom-image"]])(
    "when the custom image flag is set (%s)",
    customImageFlag => {
      it.each([["some-image"]])("should set the image to '%s'", async image => {
        await runProgramWithArgs([customImageFlag, image]);
        expect(buildModule).toBeCalled();
        expect(createOutputDirectory).toBeCalled();
        expect(generateYamlAndWriteToDisk).toBeCalled();
        expect(generateYamlAndWriteToDisk).toHaveBeenCalledWith(
          expect.objectContaining({
            assets: expect.objectContaining({
              image: image,
            }),
          }),
        );
        expect(handleCustomImageBuild).not.toBeCalled();
      });
    },
  );

  describe.each(["--timeout", "-t"])("when the timeout flag is set (%s)", timeoutFlag => {
    it("should accept a timeout in the supported range", async () => {
      await runProgramWithArgs([timeoutFlag, "10"]);
      expect(buildModule).toBeCalled();
      expect(createOutputDirectory).toBeCalled();
      expect(generateYamlAndWriteToDisk).toBeCalled();
      expect(handleCustomImageBuild).not.toBeCalled();
    });

    it.each([
      {
        value: "-1",
        error: "Number must be between 1 and 30.",
        description: "reject values below minimum",
      },
      {
        value: "31",
        error: "Number must be between 1 and 30.",
        description: "reject values above maximum",
      },
      { value: "not-a-number", error: "Not a number.", description: "reject non-numeric values" },
      { value: "5.2", error: "Value must be an integer.", description: "reject float values" },
    ])("should $description: $value", async ({ value, error }) => {
      await runProgramWithError([timeoutFlag, value], error);
    });
    // it("should reject float timeouts", async () => {
    //   await expect(program.parseAsync(["build", timeoutFlag, "5.0"], { from: "user" })).rejects.toThrowError("Value must be an integer.")
    // });
  });

  describe.each([["-e"], ["--entry-point"]])(
    "when the entry point flag is set (%s)",
    entryPointFlag => {
      it("should attempt to build the module", async () => {
        await runProgramWithArgs([entryPointFlag, "pepr.ts"]);
        expect(buildModule).toBeCalled();
      });
    },
  );

  describe.each([["-o"], ["--output"]])("when the output flag is set (%s)", outputFlag => {
    it("should create the output directory", async () => {
      await runProgramWithArgs([outputFlag, "some-directory"]);
      expect(createOutputDirectory).toBeCalled();
    });
  });

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
  const runProgramWithArgs = async (args: string[]) => {
    await program.parseAsync(["build", ...args], { from: "user" });
  };

  const runProgramWithError = async (
    args: string[],
    error: string = 'process.exit unexpectedly called with "1"',
  ) => {
    await expect(runProgramWithArgs(args)).rejects.toThrowError(error);
  };
});
