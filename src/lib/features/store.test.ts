// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureFlagStore } from "./store";
import { FeatureFlags, FeatureInfo } from "./FeatureFlags";
import { describe, beforeEach, afterEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  const addFeatureFlags = (flags: Record<string, FeatureInfo>): Record<string, FeatureInfo> => {
    // Add feature flags to the FeatureFlags object without making real feature flags
    return Object.assign(FeatureFlags, flags);
  };

  let originalEnv: NodeJS.ProcessEnv;
  let originalFeatureFlags: Record<string, FeatureInfo>;

  beforeEach(() => {
    originalFeatureFlags = { ...FeatureFlags };
    originalEnv = { ...process.env };
    featureFlagStore.reset();
    featureFlagStore.initialize();
  });

  afterEach(() => {
    process.env = originalEnv;
    //Reset FeatureFlags object
    Object.keys(FeatureFlags)
      .filter(key => !Object.keys(originalFeatureFlags).includes(key))
      .forEach(key => delete FeatureFlags[key]);
  });

  describe("when accessing features", () => {
    describe("which exist", () => {
      it.each([
        { type: "string", key: FeatureFlags.DEBUG_MODE.key, expected: "value" },
        { type: "number", key: FeatureFlags.PERFORMANCE_METRICS.key, expected: 42 },
        { type: "boolean", key: FeatureFlags.EXPERIMENTAL_API.key, expected: false },
      ])("should return $type values", ({ key, expected }) => {
        expect(featureFlagStore.get<typeof expected>(key)).toBe(expected);
      });
    });

    describe("which do not exist", () => {
      it.each([
        { type: "string", defaultValue: "default", expected: "default" },
        { type: "number", defaultValue: 100, expected: 100 },
        { type: "boolean", defaultValue: false, expected: false },
      ])("should return default $type value", ({ defaultValue, expected }) => {
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get("not-real", defaultValue)).toBe(expected);
      });

      it("should return undefined without default", () => {
        // Using a flag we know doesn't exist in our initialized set
        expect(featureFlagStore.get("not-real")).toBeUndefined();
      });
    });

    it("should return a copy of all features", () => {
      const features = featureFlagStore.getAll();
      expect(features).toEqual({
        [FeatureFlags.DEBUG_MODE.key]: "value",
        [FeatureFlags.PERFORMANCE_METRICS.key]: 42,
        [FeatureFlags.EXPERIMENTAL_API.key]: false,
      });

      features[FeatureFlags.DEBUG_MODE.key] = "modified";
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE.key)).toBe("value");
    });
  });

  describe("when initializing feature flags", () => {
    it.each([
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${FeatureFlags.EXPERIMENTAL_API.key}=advanced`,
        expectedFeatures: {
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
        initializeString: `novalue=,=noproperty,invalid`,
        expectedFeatures: {},
      },
      {
        name: "should load features from environment variables",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
        },
        initializeString: undefined,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
        },
      },
      {
        name: "should load features from string",
        envVars: {},
        initializeString: `${FeatureFlags.DEBUG_MODE.key}=true`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true,
        },
      },
      {
        name: "should allow initialization strings to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${FeatureFlags.DEBUG_MODE.key.toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${FeatureFlags.PERFORMANCE_METRICS.key.toUpperCase()}`]: "42",
        },
        initializeString: `${FeatureFlags.PERFORMANCE_METRICS.key}=99,${FeatureFlags.EXPERIMENTAL_API.key}=new`,
        expectedFeatures: {
          [FeatureFlags.DEBUG_MODE.key]: true, // From env
          [FeatureFlags.PERFORMANCE_METRICS.key]: 99, // Overridden by CLI
          [FeatureFlags.EXPERIMENTAL_API.key]: "new", // From CLI
        },
      },
    ])("$name", ({ envVars, initializeString, expectedFeatures }) => {
      // Arrange - Set environment variables
      Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });

      // Act - Initialize with provided string
      featureFlagStore.initialize(initializeString);

      // Assert - Verify expected features are set
      Object.entries(expectedFeatures).forEach(([key, value]) => {
        expect(featureFlagStore.get(key)).toBe(value);
      });
    });
  });

  describe("when validating feature flags", () => {
    it("should accept known feature flags", () => {
      featureFlagStore.initialize(`${FeatureFlags.DEBUG_MODE.key}=true`);
      expect(featureFlagStore.get(FeatureFlags.DEBUG_MODE.key)).toBe(true);
    });

    it("should throw error for unknown feature flags", () => {
      expect(() => {
        featureFlagStore.initialize("unknown_flag=value");
      }).toThrow("Unknown feature flag: unknown_flag");
    });

    it("should throw an error for unknown flags from environment variables", () => {
      process.env.PEPR_FEATURE_UNKNOWN = "value";
      expect(() => featureFlagStore.initialize()).toThrow("Unknown feature flag: unknown");
    });

    it("should provide type safety when accessing features", () => {
      featureFlagStore.initialize(`${FeatureFlags.EXPERIMENTAL_API.key}=true`);
      const value: boolean = featureFlagStore.get(FeatureFlags.EXPERIMENTAL_API.key);
      expect(value).toBe(true);
    });
  });

  describe("with a feature flag limit to reduce complexity", () => {
    it("should enforce a limit on feature count", () => {
      const featureFlagCount = Object.values(FeatureFlags).length;
      const warnThreshold = 4;

      if (featureFlagCount > warnThreshold) {
        const message = `[WARN] Too many feature flags are active (found ${featureFlagCount}, max ${warnThreshold}).
        If this is intentional, increase the 'warnThreshold' here and the 'featureFlagLimit' in features/store.ts.
        This test is a backstop to ensure developers do not accidentally increase complexity by using too many feature flags.`;
        throw new Error(message);
      }

      expect(featureFlagCount).toBeLessThanOrEqual(warnThreshold);
    });

    it("should enforce feature count validation at runtime", () => {
      addFeatureFlags({
        TEST_FEATURE1: {
          key: "test_feature1",
          metadata: { name: "Test 1", description: "Test", defaultValue: true },
        },
        TEST_FEATURE2: {
          key: "test_feature2",
          metadata: { name: "Test 2", description: "Test", defaultValue: false },
        },
      });
      expect(() => {
        featureFlagStore.initialize();
      }).toThrow("Too many feature flags active: 5 (maximum: 4)");
    });
  });
});
