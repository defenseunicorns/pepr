// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, test } from "@jest/globals";
import prompts from "prompts";
import { walkthrough, confirm } from "./walkthrough";

describe('when processing input', () =>{
  test("walkthrough() returns expected results", async () => {
    // Inject predefined answers for the prompts
    prompts.inject(["My Test Module", "A test module for Pepr", 0]);

    const result = await walkthrough();

  // Check the returned object
    expect(result).toEqual({
      name: "My Test Module",
      description: "A test module for Pepr",
      errorBehavior: 0,
    });
});

  test("walkthrough() returns expected results - name only", async () => {
    // Inject predefined answers for the prompts
    prompts.inject(["A test module for Pepr", 0]);

    const result = await walkthrough({name: "My Test Module"});

  // Check the returned object
    expect(result).toEqual({
      name: "My Test Module",
      description: "A test module for Pepr",
      errorBehavior: 0,
    });
});


  test("walkthrough() returns expected results - desc only", async () => {
    // Inject predefined answers for the prompts
    prompts.inject(["My Test Module", 0]);

    const result = await walkthrough({description: "A test module for Pepr"});

  // Check the returned object
    expect(result).toEqual({
      name: "My Test Module",
      description: "A test module for Pepr",
      errorBehavior: 0,
    });
});

  test("walkthrough() returns expected results - errorBehavior only", async () => {
    // Inject predefined answers for the prompts
    prompts.inject(["My Test Module", "A test module for Pepr"]);

    const result = await walkthrough({errorBehavior: "reject"});

  // Check the returned object
    expect(result).toEqual({
      name: "My Test Module",
      description: "A test module for Pepr",
      errorBehavior: "reject", //TODO: Verify this is actually a string
    });
});

  test("confirm() returns true when manually prompted", async () =>{
    prompts.inject(["y"]);
    const result = await confirm("some string",{path: "some path", print: "some print"}, "some Pepr TS path");
    expect(result).toBe(true);
  })

  test("confirm() returns true when set by flag prompted", async () =>{
    prompts.inject(["y"]);
    const result = await confirm("some string",{path: "some path", print: "some print"}, "some Pepr TS path", true);
    expect(result).toBe(true);
  })

  test("confirm() returns false when set by flag prompted", async () =>{
    prompts.inject(["y"]);
    const result = await confirm("some string",{path: "some path", print: "some print"}, "some Pepr TS path", false);
    expect(result).toBe(false);
  })
})