import { expect, it } from "@jest/globals";
import {
  capabilitiesWithDuplicates,
  capabilitiesWithFinalize,
  capabilitiesWithShortKey,
  mockCapabilitiesNew,
  mockCapabilitiesOld,
  newCapabilityWithDuplicates,
  newCapabilityWithFinalize,
  newCapabilityWithShortKey,
} from "./defaultTestObjects";

it("generates the same mockCapability", () => {
  expect(mockCapabilitiesNew).toEqual(mockCapabilitiesOld);
});

it("generates the same mockCapabilityWithFinalize", () => {
  expect(newCapabilityWithFinalize).toEqual(capabilitiesWithFinalize);
});

it("generates the same mockCapabilityWithDuplicates", () => {
  expect(newCapabilityWithDuplicates).toEqual(capabilitiesWithDuplicates);
});

it("generates the same mockCapabilityWithShortKey", () => {
  expect(newCapabilityWithShortKey).toEqual(capabilitiesWithShortKey);
});
