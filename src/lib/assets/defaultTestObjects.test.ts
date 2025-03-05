import { expect, it } from "@jest/globals";
import {
  mockCapabilitiesNew,
  newCapabilityWithDuplicates,
  newCapabilityWithFinalize,
  newCapabilityWithLongKey,
  newCapabilityWithShortKey,
} from "./defaultTestObjects";
import {
  capabilitiesWithDuplicates,
  capabilitiesWithFinalize,
  capabilitiesWithLongKey,
  capabilitiesWithShortKey,
  mockCapabilitiesOld,
} from "./legacy-data/defaultTestObjects";

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

it("generates the same mockCapabilityWithLongKey", () => {
  expect(newCapabilityWithLongKey).toEqual(capabilitiesWithLongKey);
});
