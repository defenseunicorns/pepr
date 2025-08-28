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

  const removeAddedFeatureFlags = () => {
    Object.keys(FeatureFlags)
      .filter(key => !Object.keys(originalFeatureFlags).includes(key))
      .forEach(key => delete FeatureFlags[key]);
  };

  let originalEnv: NodeJS.ProcessEnv;
  let originalFeatureFlags: Record<string, FeatureInfo>;

  beforeEach(() => {
    originalFeatureFlags = { ...FeatureFlags };
    originalEnv = { ...process.env };
    featureFlagStore.reset();
    addFeatureFlags({
      DEBUG_MODE: {
        key: "debug_mode",
        metadata: {
          name: "Debug Mode",
          description: "Enables verbose logging and debugging features",
          defaultValue: "value",
        },
      },
      EXPERIMENTAL_API: {
        key: "experimental_api",
        metadata: {
          name: "Experimental API",
          description: "Enables experimental APIs that may change",
          defaultValue: false,
        },
      },
      PERFORMANCE_METRICS: {
        key: "performance_metrics",
        metadata: {
          name: "Performance Metrics",
          description: "Enables collection and reporting of performance metrics",
          defaultValue: 42,
        },
      },
    });
    featureFlagStore.initialize();
  });

  afterEach(() => {
    process.env = originalEnv;
    removeAddedFeatureFlags();
  });

  describe("when accessing features", () => {
    beforeEach(() => {});
    it.each([
      { type: "string", key: "debug_mode", expected: "value" },
      { type: "number", key: "performance_metrics", expected: 42 },
      { type: "boolean", key: "experimental_api", expected: false },
    ])("should return $type values", ({ key, expected }) => {
      expect(featureFlagStore.get<typeof expected>(key)).toBe(expected);
    });

    it("should return a copy of all features", () => {
      removeAddedFeatureFlags();
      featureFlagStore.reset();
      featureFlagStore.initialize("reference_flag=false");
      const features = featureFlagStore.getAll();
      expect(features).toEqual({
        ["reference_flag"]: false,
      });

      features["reference_flag"] = true;
      expect(featureFlagStore.get("reference_flag")).toBe(false);
    });

    it("should accept known feature flags", () => {
      featureFlagStore.initialize(`${"debug_mode"}=true`);
      expect(featureFlagStore.get("debug_mode")).toBe(true);
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
      featureFlagStore.initialize(`${"experimental_api"}=true`);
      const value: boolean = featureFlagStore.get("experimental_api");
      expect(value).toBe(true);
    });
  });

  describe("when initializing feature flags", () => {
    it.each([
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${"experimental_api"}=advanced`,
        expectedFeatures: {
          ["experimental_api"]: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: `${"debug_mode"}=true,${"experimental_api"}=false`,
        expectedFeatures: {
          ["debug_mode"]: true,
          ["experimental_api"]: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: `${"debug_mode"}=5,${"experimental_api"}=10.5`,
        expectedFeatures: {
          ["debug_mode"]: 5,
          ["experimental_api"]: 10.5,
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
          [`PEPR_FEATURE_${"debug_mode".toUpperCase()}`]: "true",
        },
        initializeString: undefined,
        expectedFeatures: {
          ["debug_mode"]: true,
        },
      },
      {
        name: "should load features from string",
        envVars: {},
        initializeString: `${"debug_mode"}=true`,
        expectedFeatures: {
          ["debug_mode"]: true,
        },
      },
      {
        name: "should allow initialization strings to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${"debug_mode".toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${"performance_metrics".toUpperCase()}`]: "42",
        },
        initializeString: `${"performance_metrics"}=99,${"experimental_api"}=new`,
        expectedFeatures: {
          ["debug_mode"]: true, // From env
          ["performance_metrics"]: 99, // Overridden by CLI
          ["experimental_api"]: "new", // From CLI
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

  describe("with a feature flag limit to reduce complexity", () => {
    it("should limit total feature count", () => {
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

    it("should limit feature count at runtime", () => {
      addFeatureFlags({
        TEST_FEATURE1: {
          key: "test_feature1",
          metadata: { name: "Test 1", description: "Test", defaultValue: true },
        },
      });
      expect(() => {
        featureFlagStore.initialize();
      }).toThrow("Too many feature flags active: 5 (maximum: 4)");
    });
  });
});
