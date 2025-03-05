import { expect, it } from "@jest/globals";
import { mockCapabilitiesNew, mockCapabilitiesOld } from "./defaultTestObjects";

it("generates the same mockCapability", () => {
  expect(mockCapabilitiesNew).toEqual(mockCapabilitiesOld);
});
