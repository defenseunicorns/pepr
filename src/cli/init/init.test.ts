// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
import init from ".";

vi.mock("./asdf", async () => {
  return {
    ...vi.importActual("./asdf"),
    setupProjectStructure: vi.fn().mockResolvedValue(undefined),
    createProjectFiles: vi.fn().mockResolvedValue(undefined),
    doPostInitActions: vi.fn().mockResolvedValue(undefined),
  };
});

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
      name: "error-behavior",
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
