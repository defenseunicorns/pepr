import { expect, it } from "@jest/globals";
import {
  capabilitiesWithFinalize,
  mockCapabilitiesNew,
  mockCapabilitiesOld,
  newCapabilityWithFinalize,
} from "./defaultTestObjects";

it("generates the same mockCapability", () => {
  expect(mockCapabilitiesNew).toEqual(mockCapabilitiesOld);
});

it("generates the same mockCapabilityWithFinalize", () => {
  expect(newCapabilityWithFinalize).toEqual(capabilitiesWithFinalize);
});
