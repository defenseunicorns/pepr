// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, describe, expect, jest, it } from "@jest/globals";
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

let consoleLog: jest.Spied<typeof console.log>;
let consoleError: jest.Spied<typeof console.error>;

describe("when processing input", () => {
  beforeAll(() => {
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe("walkthough() returns expected results", () => {
    it.each([
      //Test flag combinations with [["$FLAG", ...]]
      [["description", "errorBehavior"]],
      [["description"]],
      [["errorBehavior"]],
      [["name", "description", "errorBehavior"]],
      [["name", "description"]],
      [["name", "errorBehavior"]],
      [["name"]],
      [undefined],
    ])(`when the set flags are: %s`, async (flagInput: string[] | undefined) => {
      const expected: PromptOptions = {
        name: "My Test Module",
        description: "A test module for Pepr",
        errorBehavior: OnError.REJECT,
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

    it("should prompt for errorBehavior when given invalid input", async () => {
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

    it.each([[true], [false]])(
      "when flag '--confirm' is %s",
      async (confirmFlag: boolean | undefined) => {
        const result = await confirm(
          "some string",
          { path: "some path", print: "some print" },
          "some Pepr TS path",
          confirmFlag,
        );
        expect(result).toBe(confirmFlag);
      },
    );
  });
});
