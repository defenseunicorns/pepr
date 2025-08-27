// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureFlagStore, FeatureFlags } from "./store";
import { describe, beforeEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  beforeEach(() => {
    featureFlagStore.reset();
  });

  describe("when accessing features", () => {
    beforeEach(() => {
      featureFlagStore.initialize(
        `${FeatureFlags.DEBUG_MODE}=value,${FeatureFlags.PERFORMANCE_METRICS}=42,${FeatureFlags.BETA_FEATURES}=true`,
      );
    });

    describe("which exist", () => {
      it.each([
        { type: "string", key: FeatureFlags.DEBUG_MODE, expected: "value" },
        { type: "number", key: FeatureFlags.PERFORMANCE_METRICS, expected: 42 },
        { type: "boolean", key: FeatureFlags.BETA_FEATURES, expected: true },
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
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get(FeatureFlags.EXPERIMENTAL_API, defaultValue)).toBe(expected);
      });

      it("should return undefined without default", () => {
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get(FeatureFlags.EXPERIMENTAL_API)).toBeUndefined();
      });
    });

    it("should return a copy of all features", () => {
      const features = featureFlagStore.getAll();
      expect(features).toEqual({
        [FeatureFlags.DEBUG_MODE]: "value",
        [FeatureFlags.PERFORMANCE_METRICS]: 42,
        [FeatureFlags.BETA_FEATURES]: true,
      });

      // Verify it's a copy by modifying the returned object
      features[FeatureFlags.DEBUG_MODE] = "modified";
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE)).toBe("value"); // Original remains unchanged
    });
  });

  describe("when initializing the feature-flag store", () => {
    it.each([
      {
        name: "should load features from environment variables when no string is provided",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.toUpperCase()}`]: "value",
        },
        initializeString: undefined,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: true,
          [FeatureFlags.PERFORMANCE_METRICS]: 42,
          [FeatureFlags.EXPERIMENTAL_API]: "value",
        },
      },
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE}=value,${FeatureFlags.EXPERIMENTAL_API}=advanced`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: "value",
          [FeatureFlags.EXPERIMENTAL_API]: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE}=true,${FeatureFlags.EXPERIMENTAL_API}=false`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: true,
          [FeatureFlags.EXPERIMENTAL_API]: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE}=5,${FeatureFlags.EXPERIMENTAL_API}=10.5`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: 5,
          [FeatureFlags.EXPERIMENTAL_API]: 10.5,
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
        initializeString: `${FeatureFlags.DEBUG_MODE}=true,novalue=,=noproperty,invalid`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: true,
        },
      },
      {
        name: "should load features from string when no env vars are present",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE}=true,${FeatureFlags.PERFORMANCE_METRICS}=42,${FeatureFlags.EXPERIMENTAL_API}=value`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: true,
          [FeatureFlags.PERFORMANCE_METRICS]: 42,
          [FeatureFlags.EXPERIMENTAL_API]: "value",
        },
      },
      {
        name: "should allow CLI features to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.toUpperCase()}`]: "value",
        },
        initializeString: `${FeatureFlags.PERFORMANCE_METRICS}=99,${FeatureFlags.BETA_FEATURES}=new`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE]: true, // From env
          [FeatureFlags.PERFORMANCE_METRICS]: 99, // Overridden by CLI
          [FeatureFlags.EXPERIMENTAL_API]: "value", // From env
          [FeatureFlags.BETA_FEATURES]: "new", // From CLI
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
        process.env[`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.toUpperCase()}`] = "true";
        process.env[`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.toUpperCase()}`] = "42";
        process.env[`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.toUpperCase()}`] = "value";

        // Add 2 more via string to exceed the 4 feature limit
        expect(() => {
          featureFlagStore.initialize(
            `${FeatureFlags.BETA_FEATURES}=new,${FeatureFlags.CHARLIE_FEATURES}=extra`,
          );
        }).toThrow("Too many feature flags active: 5 (maximum: 4)");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });

  // New tests specifically for feature flag validation
  describe("when validating feature flags", () => {
    it("should accept known feature flags", () => {
      featureFlagStore.initialize(`${FeatureFlags.DEBUG_MODE}=true`);
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE)).toBe(true);
    });

    it("should throw error for unknown feature flags", () => {
      expect(() => {
        featureFlagStore.initialize("unknown_flag=value");
      }).toThrow("Unknown feature flag: unknown_flag");
    });

    it("should validate flags from environment variables", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.PEPR_FEATURE_UNKNOWN = "value";
        expect(() => {
          featureFlagStore.initialize();
        }).toThrow("Unknown feature flag: unknown");
      } finally {
        process.env = originalEnv;
      }
    });

    it("should provide type safety when accessing features", () => {
      featureFlagStore.initialize(`${FeatureFlags.BETA_FEATURES}=true`);
      const value: boolean = featureFlagStore.get(FeatureFlags.BETA_FEATURES);
      expect(value).toBe(true);
    });
  });
});
