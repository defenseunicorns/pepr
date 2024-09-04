// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import prompts from "prompts";

import { walkthroughDescription, walkthroughErrorBehavior, walkthroughName } from "./walkthrough";
import { Errors } from "../../lib/errors";

// test("walkthrough() returns expected results", async () => {
//   // Inject predefined answers for the prompts
//   prompts.inject(["My Test Module", "A test module for Pepr", 0]);

//   const result = await walkthrough();

//   // Check the returned object
//   expect(result).toEqual({
//     name: "My Test Module",
//     description: "A test module for Pepr",
//     errorBehavior: 0,
//   });
// });

test("walkthroughName(param) returns expected results", async () => {
  const result = await walkthroughName("asdf");

  // Check the returned object
  expect(result).toEqual(
    {name: "asdf"}
  );
});

test("walkthroughName() returns expected results", async () => {
  prompts.inject(["asdf"]);
  const result = await walkthroughName();

  // Check the returned object
  expect(result).toEqual(
    {name: "asdf"}
  );
});


test("walkthroughDescription(param) returns expected results", async () => {
  const result = await walkthroughDescription("dessy");

  // Check the returned object
  expect(result).toEqual(
    {description: "dessy"}
  );
});

test("walkthroughDescription() returns expected results", async () => {
  prompts.inject(["dessy"]);
  const result = await walkthroughDescription();

  // Check the returned object
  expect(result).toEqual(
    {description: "dessy"}
  );
});

test("walkthroughErrorBehavior(param) returns expected results", async () => {
  const result = await walkthroughErrorBehavior("reject");

  // Check the returned object
  expect(result).toEqual(
    {errorBehavior: Errors.reject}
  );
});

test("walkthroughErrorBehavior() returns expected results", async () => {
  prompts.inject(["reject"]);
  const result = await walkthroughErrorBehavior();

  // Check the returned object
  expect(result).toEqual(
    {errorBehavior: Errors.reject}
  );
});