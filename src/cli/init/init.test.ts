// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
import init from ".";
import { setupProjectStructure } from "./setupProjectStructure";
import { doPostInitActions } from "./doPostInitActions";
import { createProjectFiles } from "./createProjectFiles";
import { v4 as uuidv4 } from "uuid";

vi.mock("./setupProjectStructure", async () => {
  return {
    ...vi.importActual("./setupProjectStructure"),
    setupProjectStructure: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("./createProjectFiles", async () => {
  return {
    ...vi.importActual("./createProjectFiles"),
    createProjectFiles: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("./doPostInitActions", async () => {
  return {
    ...vi.importActual("./doPostInitActions"),
    doPostInitActions: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("prompts", () => {
  return {
    default: vi.fn().mockImplementation(() => Promise.resolve({ yes: true, uuid: "manual-uuid" })),
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
    expect(genPkgJSONSpy).toBeCalled();
  });

  it("should throw an error if module creation fails", async () => {
    setupProjectStructure.mockImplementationOnce(() => Promise.reject(new Error("an error")));
    await runProgramWithError(defaultArgs);
    expect(setupProjectStructure).toBeCalled(); // Changed from not.toBeCalled()
    expect(createProjectFiles).not.toBeCalled();
    expect(doPostInitActions).not.toBeCalled();
    expect(genPkgJSONSpy).not.toBeCalled();
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
            const args = replaceArgumentValue(defaultArgs, flag, validOption);
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

  describe.each(["--uuid", "-u"])("when the uuid flag is set (%s)", uuidFlag => {
    it.each([["🚀"], ["asdf"], ["some-uuid"], ["64ef143f-26de-48c8-a338-54a11fd7af16"]])(
      "should accept a valid uuid (%s)",
      async uuidValue => {
        const args = replaceArgumentValue(defaultArgs, uuidFlag, uuidValue);
        await runProgramWithArgs(args);
        expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ uuid: uuidValue }),
        );
      },
    );

    it("should generate a uuid when given an empty string", async () => {
      const args = replaceArgumentValue(defaultArgs, uuidFlag, "");
      await runProgramWithArgs(args);
      expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          uuid: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          ),
        }),
      );
    });

    it.each([
      {
        value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaB",
        error: "The UUID must be 36 characters or fewer.",
        description: "reject long values",
      },
    ])("should $description: $value", async ({ value, error }) => {
      const args = replaceArgumentValue(defaultArgs, uuidFlag, value);
      await runProgramWithError(args, error);
    });
  });

  describe("when uuid prompt is used", () => {
    it("should prompt for uuid", async () => {
      await runProgramWithArgs([
        ...defaultArgs.filter(arg => arg !== "--uuid").filter(arg => arg !== "test-uuid"),
      ]);
      expect(promptsSpy).toBeCalledWith([
        expect.objectContaining({
          message: "Enter a unique identifier for the new Pepr module.\n",
        }),
      ]);
      expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ uuid: "manual-uuid" }),
      );
    });
    it("should generate a uuid when given an empty string", async () => {
      const testUuid = uuidv4();
      promptsSpy.mockImplementationOnce(() => Promise.resolve({ uuid: testUuid }));

      await runProgramWithArgs([
        ...defaultArgs.filter(arg => arg !== "--uuid").filter(arg => arg !== "test-uuid"),
      ]);

      expect(promptsSpy).toBeCalledWith([
        expect.objectContaining({
          message: "Enter a unique identifier for the new Pepr module.\n",
        }),
      ]);
      expect(genPkgJSONSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ uuid: testUuid }),
      );
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

  const replaceArgumentValue = (
    currentArgs: string[],
    argFlag: string,
    newValue: string,
  ): string[] => {
    const newArgs = [...currentArgs];
    newArgs.splice(currentArgs.indexOf(`${argFlag}`), 2, argFlag, newValue);
    return newArgs;
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
