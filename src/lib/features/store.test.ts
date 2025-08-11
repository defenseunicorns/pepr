// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureFlagStore } from "./store";
import { describe, beforeEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  beforeEach(() => {
    featureFlagStore.reset();
  });

  describe("when accessing features", () => {
    beforeEach(() => {
      featureFlagStore.initialize("string=value,number=42,boolean=true");
    });

    describe("which exist", () => {
      it.each([
        { type: "string", key: "string", expected: "value" },
        { type: "number", key: "number", expected: 42 },
        { type: "boolean", key: "boolean", expected: true },
      ])("should return $type values", ({ key, expected }) => {
        expect(featureFlagStore.get<typeof expected>(key)).toBe(expected);
      });
    });

    describe("with non-existent features", () => {
      it.each([
        { type: "string", defaultValue: "default", expected: "default" },
        { type: "number", defaultValue: 100, expected: 100 },
        { type: "boolean", defaultValue: false, expected: false },
      ])("should return default $type value", ({ defaultValue, expected }) => {
        expect(featureFlagStore.get("nonexistent", defaultValue)).toBe(expected);
      });

      it("should return undefined without default", () => {
        expect(featureFlagStore.get("nonexistent")).toBeUndefined();
      });
    });

    it("should return a copy of all features", () => {
      const features = featureFlagStore.getAll();
      expect(features).toEqual({
        string: "value",
        number: 42,
        boolean: true,
      });

      // Verify it's a copy by modifying the returned object
      features.string = "modified";
      expect(featureFlagStore.get("string")).toBe("value"); // Original remains unchanged
    });
  });

  describe("when initializing the feature-flag store", () => {
    it.each([
      {
        name: "should load features from environment variables when no string is provided",
        envVars: {
          PEPR_FEATURE_TEST1: "true",
          PEPR_FEATURE_TEST2: "42",
          PEPR_FEATURE_TEST3: "value",
        },
        initializeString: undefined,
        expectedFeatures: {
          test1: true,
          test2: 42,
          test3: "value",
        },
      },
      {
        name: "should parse string values",
        envVars: {},
        initializeString: "feature1=value,feature2=advanced",
        expectedFeatures: {
          feature1: "value",
          feature2: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: "feature1=true,feature2=false",
        expectedFeatures: {
          feature1: true,
          feature2: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: "feature1=5,feature2=10.5",
        expectedFeatures: {
          feature1: 5,
          feature2: 10.5,
        },
      },
      {
        name: "should handle empty initialization strings",
        envVars: {},
        initializeString: "",
        expectedFeatures: {},
      },
      {
        name: "should handle malformed entries",
        envVars: {},
        initializeString: "valid=true,novalue=,=noproperty,invalid",
        expectedFeatures: {
          valid: true,
        },
      },
      {
        name: "should load features from string when no env vars are present",
        envVars: {},
        initializeString: "feature1=true,feature2=42,feature3=value",
        expectedFeatures: {
          feature1: true,
          feature2: 42,
          feature3: "value",
        },
      },
      {
        name: "should allow CLI features to override environment variables",
        envVars: {
          PEPR_FEATURE_TEST1: "true",
          PEPR_FEATURE_TEST2: "42",
          PEPR_FEATURE_TEST3: "value",
        },
        initializeString: "test2=99,feature4=new",
        expectedFeatures: {
          test1: true, // From env
          test2: 99, // Overridden by CLI
          test3: "value", // From env
          feature4: "new", // From CLI
        },
      },
    ])("$name", ({ envVars, initializeString, expectedFeatures }) => {
      // Save original process.env
      const originalEnv = { ...process.env };
      try {
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
          process.env[key] = value;
        });

        // Initialize with provided string
        featureFlagStore.initialize(initializeString);

        Object.entries(expectedFeatures).forEach(([key, value]) => {
          expect(featureFlagStore.get(key)).toBe(value);
        });
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });

    it("should enforce feature count validation", () => {
      // Save original process.env
      const originalEnv = { ...process.env };
      try {
        // Set 3 env variables
        process.env.PEPR_FEATURE_TEST1 = "true";
        process.env.PEPR_FEATURE_TEST2 = "42";
        process.env.PEPR_FEATURE_TEST3 = "value";

        // Add 2 more via string to exceed the 4 feature limit
        expect(() => {
          featureFlagStore.initialize("feature4=new,feature5=extra");
        }).toThrow("Too many feature flags active: 5 (maximum: 4)");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });
});
