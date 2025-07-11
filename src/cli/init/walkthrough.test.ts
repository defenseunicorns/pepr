// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, describe, expect, vi, it, type MockInstance } from "vitest";
import prompts from "prompts";
import {
  walkthrough,
  confirm,
  PromptOptions,
  PartialPromptOptions,
  setName,
  setErrorBehavior,
} from "./walkthrough";
import { OnError } from "./enums";

let consoleLog: MockInstance<typeof console.log>;
let consoleError: MockInstance<typeof console.error>;

describe("when processing input", () => {
  beforeAll(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe("walkthough() returns expected results", () => {
    it.each([
      //Test flag combinations with [["$FLAG", ...]]
      [["description", "error-behavior"]],
      [["description"]],
      [["error-behavior"]],
      [["name", "description", "error-behavior"]],
      [["name", "description"]],
      [["name", "error-behavior"]],
      [["name"]],
      [undefined],
    ])(`when the set flags are: %s`, async (flagInput: string[] | undefined) => {
      const expected: PromptOptions = {
        name: "My Test Module",
        description: "A test module for Pepr",
        errorBehavior: OnError.REJECT,
        uuid: "unique-identifier",
      };

      // Set values for the flag(s) under test by making a subset of (expected)
      type SupportedFlagNames = keyof typeof expected;
      type PartialTestInput = { [key in SupportedFlagNames]?: string };
      const setFlags =
        flagInput?.reduce((acc: PartialTestInput, key: string) => {
          if (key in expected) {
            acc[key as SupportedFlagNames] = expected[key as SupportedFlagNames];
          }
          return acc;
        }, {} as PartialTestInput) || {};

      // Simulate user-input for unset flags by making a subset of (expected - setFlags)
      const promptInput = flagInput
        ? Object.entries(expected)
            .filter(([key]) => !flagInput.includes(key))
            .map(([, value]) => value)
        : Object.values(expected);
      prompts.inject(Object.values(promptInput));

      const result = await walkthrough(setFlags as PartialPromptOptions);

      expect(result).toEqual(expected);
    });

    it("should prompt for input when given invalid input", async () => {
      const expected = { name: "aaa" };
      prompts.inject(["aaa"]);
      const result = await setName("aa");
      expect(result).toStrictEqual(expected);
    });

    it("should prompt for error-behavior when given invalid input", async () => {
      const expected = { errorBehavior: "audit" };
      prompts.inject(["audit"]);
      const result = await setErrorBehavior("not-valid" as OnError); // Type-Coercion forces invalid input
      expect(result).toStrictEqual(expected);
    });
  });

  describe("confirm() handles input", () => {
    it.each([
      ["n", false],
      ["no", false],
      ["y", true],
      ["yes", true],
    ])("when prompt input is '%s'", async (userInput: string, expected: boolean) => {
      prompts.inject([userInput]);
      const result = await confirm(
        "some string",
        { path: "some path", print: "some print" },
        "some Pepr TS path",
      );
      expect(result).toBe(expected);
    });

    it.each([[true], [false]])("when flag '--yes' is %s", async (yesFlag: boolean | undefined) => {
      const result = await confirm(
        "some string",
        { path: "some path", print: "some print" },
        "some Pepr TS path",
        yesFlag,
      );
      expect(result).toBe(yesFlag);
    });
  });
});
