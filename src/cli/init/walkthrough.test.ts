// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it } from "@jest/globals";
import prompts from "prompts";
import { walkthrough, confirm, FinalPromptOptions } from "./walkthrough";

describe("when processing input", () => {
  describe("walkthough() returns expected results", () => {
    it.each(
      [
        ["description", ["My Test Module", "reject"]],
        ["errorBehavior", ["My Test Module", "A test module for Pepr"]],
        ["name", ["A test module for Pepr", "reject"]],
        [undefined, ["My Test Module", "A test module for Pepr", "reject"]],
  ]
    )(`when the active flag is %s`, async (flagInput: string | undefined, promptInput) => {

    const allFlagsSet: FinalPromptOptions = {name: "My Test Module", description: "A test module for Pepr", errorBehavior: "reject"};
    const activeFlag = Object.entries(allFlagsSet).filter(([key]) => key === flagInput).reduce((accumulator, [key, value]) => ({[key]: value}), {})

    prompts.inject(promptInput);

    const result = await walkthrough(activeFlag);

    // Check the returned object
    expect(result).toEqual({
      name: "My Test Module",
      description: "A test module for Pepr",
      errorBehavior: "reject", //TODO: Verify this is actually a string
    });
    })
  })

  describe("confirm() handles input", () =>{
    it.each(
      [
        ["y", true],
        ["n", false]
      ]
    )("when prompt input is %s", async (userInput: string, expected: boolean) =>{
    prompts.inject([userInput])
    const result = await confirm(
      "some string",
      { path: "some path", print: "some print" },
      "some Pepr TS path",
    );
    expect(result).toBe(expected);
    })

    it.each(
      [
        [true],
        [false]
      ]
    )("when flag input is %s", async (confirmFlag: boolean | undefined) =>{
    const result = await confirm(
      "some string",
      { path: "some path", print: "some print" },
      "some Pepr TS path",
      confirmFlag,
    );
    expect(result).toBe(confirmFlag);
    })
  })
})