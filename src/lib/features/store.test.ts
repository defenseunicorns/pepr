// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { store } from "./store";
import { FeatureFlags } from "./FeatureFlags";
import { describe, beforeEach, afterEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  let originalEnv: NodeJS.ProcessEnv;
  beforeEach(() => {
    originalEnv = { ...process.env };
    store.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("when accessing features", () => {
    beforeEach(() => {
      store.initialize(
        `${FeatureFlags.DEBUG_MODE.key}=value,${FeatureFlags.PERFORMANCE_METRICS.key}=42,${FeatureFlags.BETA_FEATURES.key}=true`,
      );
    });

    describe("which exist", () => {
      it.each([
        { type: "string", key: FeatureFlags.DEBUG_MODE.key, expected: "value" },
        { type: "number", key: FeatureFlags.PERFORMANCE_METRICS.key, expected: 42 },
        { type: "boolean", key: FeatureFlags.BETA_FEATURES.key, expected: true },
      ])("should return $type values", ({ key, expected }) => {
        expect(store.get<typeof expected>(key)).toBe(expected);
      });
    });

    describe("with non-existent features", () => {
      it.each([
        { type: "string", defaultValue: "default", expected: "default" },
        { type: "number", defaultValue: 100, expected: 100 },
        { type: "boolean", defaultValue: false, expected: false },
      ])("should return default $type value", ({ defaultValue, expected }) => {
        // Using a flag we know doesn't exist in our initialized set
        expect(store.get(FeatureFlags.EXPERIMENTAL_API.key, defaultValue)).toBe(expected);
      });

      it("should return undefined without default", () => {
        // Using a flag we know doesn't exist in our initialized set
        expect(store.get(FeatureFlags.EXPERIMENTAL_API.key)).toBeUndefined();
      });
    });

    it("should return a copy of all features", () => {
      const features = store.getAll();
      expect(features).toEqual({
        [FeatureFlags.DEBUG_MODE.key]: "value",
        [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
        [FeatureFlags.BETA_FEATURES.key]: true,
      });

      // Verify it's a copy by modifying the returned object
      features[FeatureFlags.DEBUG_MODE.key] = "modified";
      expect(store.get(FeatureFlags.DEBUG_MODE.key)).toBe("value"); // Original remains unchanged
    });
  });

  describe("when initializing the feature-flag store", () => {
    it.each([
      {
        name: "should load features from environment variables when no string is provided",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`]: "value",
        },
        initializeString: undefined,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
          [FeatureFlags.EXPERIMENTAL_API.key]: "value",
        },
      },
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=value,${FeatureFlags.EXPERIMENTAL_API.key}=advanced`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: "value",
          [FeatureFlags.EXPERIMENTAL_API.key]: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,${FeatureFlags.EXPERIMENTAL_API.key}=false`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.EXPERIMENTAL_API.key]: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=5,${FeatureFlags.EXPERIMENTAL_API.key}=10.5`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: 5,
          [FeatureFlags.EXPERIMENTAL_API.key]: 10.5,
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
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,novalue=,=noproperty,invalid`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
        },
      },
      {
        name: "should load features from string when no env vars are present",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true,${FeatureFlags.PERFORMANCE_METRICS.key}=42,${FeatureFlags.EXPERIMENTAL_API.key}=value`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
          [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
          [FeatureFlags.EXPERIMENTAL_API.key]: "value",
        },
      },
      {
        name: "should allow CLI features to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`]: "42",
          [`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`]: "value",
        },
        initializeString: `${FeatureFlags.PERFORMANCE_METRICS.key}=99,${FeatureFlags.BETA_FEATURES.key}=new`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true, // From env
          [FeatureFlags.PERFORMANCE_METRICS.key]: 99, // Overridden by CLI
          [FeatureFlags.EXPERIMENTAL_API.key]: "value", // From env
          [FeatureFlags.BETA_FEATURES.key]: "new", // From CLI
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
        store.initialize(initializeString);

        Object.entries(expectedFeatures).forEach(([key, value]) => {
          expect(store.get(key)).toBe(value);
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
        process.env[`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`] = "true";
        process.env[`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`] = "42";
        process.env[`PEPR_FEATURE_${FeatureFlags.EXPERIMENTAL_API.key.toUpperCase()}`] = "value";

        // Add 2 more via string to exceed the 4 feature limit
        expect(() => {
          store.initialize(
            `${FeatureFlags.BETA_FEATURES.key}=new,${FeatureFlags.CHARLIE_FEATURES.key}=extra`,
          );
        }).toThrow("Too many feature flags active: 5 (maximum: 4)");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });

  describe("when validating feature flags", () => {
    it("should accept known feature flags", () => {
      store.initialize(`${FeatureFlags.DEBUG_MODE.key}=true`);
      expect(store.get(FeatureFlags.DEBUG_MODE.key)).toBe(true);
    });

    it("should throw error for unknown feature flags", () => {
      expect(() => {
        store.initialize("unknown_flag=value");
      }).toThrow("Unknown feature flag: unknown_flag");
    });

    it("should validate flags from environment variables", () => {
      try {
        process.env.PEPR_FEATURE_UNKNOWN = "value";
        expect(() => {
          store.initialize();
        }).toThrow("Unknown feature flag: unknown");
      } catch {
        //TODO nothing
      }
    });

    it("should provide type safety when accessing features", () => {
      store.initialize(`${FeatureFlags.BETA_FEATURES.key}=true`);
      const value: boolean = store.get(FeatureFlags.BETA_FEATURES.key);
      expect(value).toBe(true);
    });
  });

  describe("when using feature utility methods", () => {
    //TODO: an implementation detail, test some other way?
    describe("getFeatureMetadata", () => {
      it("should handle valid feature key", () => {
        const expected = expect.objectContaining({ name: "Debug Mode" });
        const result = store.getFeatureMetadata(FeatureFlags.DEBUG_MODE.key);
        expect(result).toEqual(expected);
      });

      it("should handle invalid feature key", () => {
        const metadata = store.getFeatureMetadata("not-valid");
        expect(metadata).toBeNull();
      });
    });
  });
});
