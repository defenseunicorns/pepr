// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
import init from ".";
import { createProjectFiles, doPostInitActions, setupProjectStructure } from "./asdf";

vi.mock("./asdf", async () => {
  return {
    ...vi.importActual("./asdf"),
    setupProjectStructure: vi.fn().mockResolvedValue(undefined),
    createProjectFiles: vi.fn().mockResolvedValue(undefined),
    doPostInitActions: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("prompts", () => {
  return {
    default: vi.fn().mockImplementation(() => Promise.resolve({ yes: true })),
  };
});

const promptsSpy = vi.mocked(await import("prompts")).default;
vi.spyOn(console, "log");
const genPkgJSONSpy = vi.spyOn(await import("./templates"), "genPkgJSON");
// vi.mock("../../lib/telemetry/logger", () => ({
//   __esModule: true,
//   default: {
//     info: vi.fn(),
//   },
// }));

describe("init CLI command", () => {
  let program: Command;
  let stderrSpy;
  let exitSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.addCommand(init());
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit");
  });

  const defaultArgs = [
    "--name",
    "test-name",
    "--description",
    "test-description",
    "--error-behavior",
    "audit",
    "--uuid",
    "test-uuid",
    "--yes",
  ];
  it("should call the Build command with default values", async () => {
    await runProgramWithArgs(defaultArgs);
    expect(setupProjectStructure).toBeCalled();
    expect(createProjectFiles).toBeCalled();
    expect(doPostInitActions).toBeCalled();
  });

  type CommonTestCase = {
    name: string;
    shortFlag: string;
    longFlag: string;
    enumValues?: string[];
    invalidEnumValues?: string[];
  };

  //TODO: A boolean flag test
  // {
  //   name: "skip-post-init",
  //   shortFlag: "-s",
  //   longFlag: "--skip-post-init",
  // },
  // {
  //   name: "yes",
  //   shortFlag: "-y",
  //   longFlag: "--yes",
  // },
  const flagTestCases: CommonTestCase[] = [
    {
      name: "description",
      shortFlag: "-d",
      longFlag: "--description",
    },
    {
      name: "errorBehavior",
      shortFlag: "-e",
      longFlag: "--error-behavior",
      enumValues: ["audit", "ignore", "reject"],
      invalidEnumValues: ["invalid"],
    },
    {
      name: "name",
      shortFlag: "-n",
      longFlag: "--name",
    },
    {
      name: "uuid",
      shortFlag: "-u",
      longFlag: "--uuid",
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
            //TODO: clunky
            const args = [...defaultArgs];
            args.splice(args.indexOf(`--${name}`), 2, flag, validOption);
            await runProgramWithArgs(args);
            expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
              expect.objectContaining({ [name]: validOption }),
            );
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

  describe.only.each(["--uuid", "-u"])("when the uuid flag is set (%s)", uuidFlag => {
    it.each([["🚀"], ["asdf"], ["some-uuid"], ["64ef143f-26de-48c8-a338-54a11fd7af16"]])(
      "should accept a valid uuid (%s)",
      async uuidValue => {
        //TODO: clunky
        const args = [...defaultArgs];
        args.splice(args.indexOf(`${uuidFlag}`), 2, uuidFlag, uuidValue);
        await runProgramWithArgs(args);
        expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ uuid: uuidValue }),
        );
      },
    );

    it.each([
      {
        value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB",
        error: "The UUID must be 36 characters or fewer.",
        description: "reject long values",
      },
      // { value: "", error: "Value must be an integer.", description: "reject empty values" },
    ])("should $description: $value", async ({ value, error }) => {
      await runProgramWithError([uuidFlag, value], error);
    });
  });

  describe.each([["-s"], ["--skip-post-init"]])("when post-init is skipped via %s", flag => {
    it("should not call doPostInitActions", async () => {
      await runProgramWithArgs([...defaultArgs, flag]);
      expect(doPostInitActions).not.toBeCalled();
    });
  });

  describe("when verification is used", () => {
    it("should prompt for verification", async () => {
      await runProgramWithArgs([...defaultArgs.filter(arg => arg !== "--yes")]);
      expect(promptsSpy).toBeCalledWith([
        expect.objectContaining({ message: "Create the new Pepr module?" }),
      ]);
      expect(console.log).toBeCalledWith(expect.stringContaining("To be generated:"));
    });
  });

  describe.each([["-y"], ["--yes"]])("when verification is skipped via %s", flag => {
    it("should not prompt for verification", async () => {
      await runProgramWithArgs([...defaultArgs, flag]);
      expect(promptsSpy).not.toBeCalled();
      expect(console.log).not.toBeCalledWith("Create the new Pepr module?");
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
    await program.parseAsync(["init", ...args], { from: "user" });
  };

  const runProgramWithError = async (
    args: string[],
    error: string = 'process.exit unexpectedly called with "1"',
  ) => {
    await expect(runProgramWithArgs(args)).rejects.toThrowError(error);
  };
});
