// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { it, expect, beforeEach, describe, vi, MockInstance } from "vitest";
import init from ".";
import { setupProjectStructure } from "./setupProjectStructure";
import { doPostInitActions } from "./doPostInitActions";
import { createProjectFiles } from "./createProjectFiles";
import { v4 as uuidv4 } from "uuid";
import Log from "../../lib/telemetry/logger";

// Setup mocks
vi.mock("./setupProjectStructure");
vi.mock("./createProjectFiles");
vi.mock("./doPostInitActions");
vi.mock("prompts", () => ({
  default: vi.fn().mockImplementation(() => Promise.resolve({ yes: true, uuid: "manual-uuid" })),
}));
vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: { info: vi.fn(), warn: vi.fn() },
}));

// Mock references
const mockedSetupProjectStructure = vi.mocked(setupProjectStructure);
const promptsSpy = vi.mocked(await import("prompts")).default;
const genPkgJSONSpy = vi.spyOn(await import("./templates"), "genPkgJSON");

// Mock console.log to avoid noise during tests
vi.spyOn(console, "log").mockImplementation(() => {
  vi.fn();
});

// Test data
type FlagTestCase = {
  name: string;
  shortFlag: string;
  longFlag: string;
  enumValues?: string[];
  invalidEnumValues?: string[];
};

const FLAGS = {
  description: { name: "description", shortFlag: "-d", longFlag: "--description" },
  errorBehavior: {
    name: "errorBehavior",
    shortFlag: "-e",
    longFlag: "--error-behavior",
    enumValues: ["audit", "ignore", "reject"],
    invalidEnumValues: ["invalid"],
  },
  name: { name: "name", shortFlag: "-n", longFlag: "--name" },
  uuid: { name: "uuid", shortFlag: "-u", longFlag: "--uuid" },
  yes: { shortFlag: "-y", longFlag: "--yes" },
  skipPostInit: { shortFlag: "-s", longFlag: "--skip-post-init" },
};

const DEFAULT_ARGS = {
  long: [
    FLAGS.name.longFlag,
    "test-name",
    FLAGS.description.longFlag,
    "test-description",
    FLAGS.errorBehavior.longFlag,
    "audit",
    FLAGS.uuid.longFlag,
    "test-uuid",
    FLAGS.yes.longFlag,
  ],
  short: [
    FLAGS.name.shortFlag,
    "test-name",
    FLAGS.description.shortFlag,
    "test-description",
    FLAGS.errorBehavior.shortFlag,
    "audit",
    FLAGS.uuid.shortFlag,
    "test-uuid",
    FLAGS.yes.shortFlag,
  ],
};

const VALID_UUID_SAMPLES = ["🚀", "asdf", "some-uuid", "64ef143f-26de-48c8-a338-54a11fd7af16"];

describe("init CLI command", () => {
  let program: Command;
  let stderrSpy: MockInstance;
  let exitSpy: MockInstance;

  // Helper functions
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

  // Setup for each test
  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.addCommand(init());
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit");
  });

  it("should call the Build command with default values", async () => {
    await runProgramWithArgs(DEFAULT_ARGS.long);

    expect(mockedSetupProjectStructure).toBeCalled();
    expect(createProjectFiles).toBeCalled();
    expect(doPostInitActions).toBeCalled();
    expect(genPkgJSONSpy).toBeCalled();
    expect(Log.info).toBeCalledWith(expect.stringContaining("Creating new Pepr module..."));
    expect(Log.info).toBeCalledWith(
      expect.stringContaining("New Pepr module created at test-name"),
    );
    expect(Log.info).toBeCalledWith(
      expect.stringContaining("Open VSCode or your editor of choice in test-name to get started!"),
    );
  });

  it("should throw an error if module creation fails", async () => {
    mockedSetupProjectStructure.mockImplementationOnce(() => Promise.reject(new Error("an error")));
    expect(runProgramWithError(DEFAULT_ARGS.long, "Error creating Pepr module:"));
    expect(setupProjectStructure).not.toBeCalled();
    expect(createProjectFiles).not.toBeCalled();
    expect(doPostInitActions).not.toBeCalled();
  });

  // Test flag parameters
  const flagTestCases: FlagTestCase[] = [
    FLAGS.description,
    FLAGS.errorBehavior,
    FLAGS.name,
    FLAGS.uuid,
  ];

  describe.each(flagTestCases)("when options accept user-input", ({ shortFlag, longFlag }) => {
    describe.each([{ flag: shortFlag }, { flag: longFlag }])("$name via $flag", ({ flag }) => {
      it("should require a value", async () => {
        await runProgramWithError([flag]);
        expectMissingArgument(stderrSpy);
      });
    });
  });

  const enumFlagTestCases = flagTestCases.filter(testCase => testCase.enumValues !== undefined);

  describe.each(enumFlagTestCases)(
    "when options are enumerated",
    ({ name, shortFlag, longFlag, enumValues }) => {
      const testCases = [
        { flag: shortFlag, defaultArgs: DEFAULT_ARGS.short },
        { flag: longFlag, defaultArgs: DEFAULT_ARGS.long },
      ];

      describe.each(testCases)("$name via $flag", ({ flag, defaultArgs }) => {
        it.each(enumValues?.map(opt => [opt]) || [])(
          "should accept '%s' as the value",
          async validOption => {
            const args = replaceArgumentValue(defaultArgs, flag, validOption as string);
            await runProgramWithArgs(args);
            expect(genPkgJSONSpy).toHaveBeenCalledWith(
              expect.objectContaining({ [name]: validOption }),
            );
          },
        );

        if (enumValues) {
          const invalidTests = [["unsupported"]].concat(
            FLAGS.errorBehavior.invalidEnumValues?.map(v => [v]) || [],
          );

          it.each(invalidTests)("should reject unsupported values ('%s')", async invalidInput => {
            await runProgramWithError([flag, invalidInput]);
            expectInvalidOption(stderrSpy, enumValues);
            expect(exitSpy).toHaveBeenCalledWith(1);
          });
        }
      });
    },
  );

  // UUID validation tests
  const uuidTestCases = [
    { flag: FLAGS.uuid.longFlag, defaultArgs: DEFAULT_ARGS.long },
    { flag: FLAGS.uuid.shortFlag, defaultArgs: DEFAULT_ARGS.short },
  ];

  describe.each(uuidTestCases)("when the uuid flag is set $flag", ({ flag, defaultArgs }) => {
    it.each(VALID_UUID_SAMPLES.map(id => [id]))(
      "should accept a valid uuid (%s)",
      async uuidValue => {
        const args = replaceArgumentValue(defaultArgs, flag, uuidValue as string);
        await runProgramWithArgs(args);
        expect(genPkgJSONSpy).toHaveBeenCalledWith(expect.objectContaining({ uuid: uuidValue }));
      },
    );

    it("should generate a uuid when given an empty string", async () => {
      const args = replaceArgumentValue(defaultArgs, flag, "");
      await runProgramWithArgs(args);
      expect(genPkgJSONSpy).toHaveBeenCalledWith(
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
      const args = replaceArgumentValue(defaultArgs, flag, value);
      await runProgramWithError(args, error);
    });
  });

  // UUID prompt tests
  describe("when uuid prompt is used", () => {
    const argsWithoutUuid = DEFAULT_ARGS.long.filter(
      arg => arg !== FLAGS.uuid.longFlag && arg !== "test-uuid",
    );

    it("should prompt for uuid", async () => {
      await runProgramWithArgs(argsWithoutUuid);
      expect(promptsSpy).toBeCalledWith([
        expect.objectContaining({
          message: "Enter a unique identifier for the new Pepr module.\n",
        }),
      ]);
      expect(genPkgJSONSpy).toHaveBeenCalledWith(expect.objectContaining({ uuid: "manual-uuid" }));
    });

    it("should use provided uuid from prompt", async () => {
      const testUuid = uuidv4();
      promptsSpy.mockImplementationOnce(() => Promise.resolve({ uuid: testUuid }));
      await runProgramWithArgs(argsWithoutUuid);
      expect(promptsSpy).toBeCalled();
      expect(genPkgJSONSpy).toHaveBeenCalledWith(expect.objectContaining({ uuid: testUuid }));
    });
  });

  describe.each([[FLAGS.skipPostInit.longFlag], [FLAGS.skipPostInit.shortFlag]])(
    "when post-init is skipped via %s",
    flag => {
      it("should not call doPostInitActions", async () => {
        await runProgramWithArgs([...DEFAULT_ARGS.long, flag]);
        expect(doPostInitActions).not.toBeCalled();
      });
    },
  );

  describe("when verification is used", () => {
    it("should prompt for verification", async () => {
      await runProgramWithArgs(DEFAULT_ARGS.long.filter(arg => arg !== FLAGS.yes.longFlag));
      expect(promptsSpy).toBeCalledWith([
        expect.objectContaining({ message: "Create the new Pepr module?" }),
      ]);
      expect(console.log).toBeCalledWith(expect.stringContaining("To be generated:"));
    });
  });

  describe.each([[FLAGS.yes.longFlag], [FLAGS.yes.shortFlag]])(
    "when verification is skipped via %s",
    flag => {
      it("should not prompt for verification", async () => {
        await runProgramWithArgs([...DEFAULT_ARGS.long, flag]);
        expect(promptsSpy).not.toBeCalled();
        expect(Log.info).not.toBeCalledWith("Create the new Pepr module?");
      });
    },
  );
});
