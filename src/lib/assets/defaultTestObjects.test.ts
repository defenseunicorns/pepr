import { expect, it } from "@jest/globals";
import {
  mockCapabilities,
  capabilityWithDuplicates,
  capabilityWithFinalize,
  capabilityWithLongKey,
  capabilityWithShortKey,
} from "./defaultTestObjects";
import {
  capabilitiesWithDuplicates,
  capabilitiesWithFinalize,
  capabilitiesWithLongKey,
  capabilitiesWithShortKey,
  mockCapabilitiesOld,
} from "./legacy-data/defaultTestObjects";

it("generates the same mockCapability", () => {
  expect(mockCapabilities).toEqual(mockCapabilitiesOld);
});

it("generates the same mockCapabilityWithFinalize", () => {
  expect(capabilityWithFinalize).toEqual(capabilitiesWithFinalize);
});

it("generates the same mockCapabilityWithDuplicates", () => {
  expect(capabilityWithDuplicates).toEqual(capabilitiesWithDuplicates);
});

it("generates the same mockCapabilityWithShortKey", () => {
  expect(capabilityWithShortKey).toEqual(capabilitiesWithShortKey);
});

it("generates the same mockCapabilityWithLongKey", () => {
  expect(capabilityWithLongKey).toEqual(capabilitiesWithLongKey);
});
