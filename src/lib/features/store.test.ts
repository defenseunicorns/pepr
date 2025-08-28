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
    addFeatureFlags({
      FAKE_STRING: {
        key: "fake_string",
        metadata: {
          name: "Debug Mode",
          description: "Enables verbose logging and debugging features",
          defaultValue: "value",
        },
      },
      FAKE_BOOLEAN: {
        key: "fake_boolean",
        metadata: {
          name: "Experimental API",
          description: "Enables experimental APIs that may change",
          defaultValue: false,
        },
      },
      FAKE_NUMBER: {
        key: "fake_number",
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
      { type: "string", key: "fake_string", expected: "value" },
      { type: "number", key: "fake_number", expected: 42 },
      { type: "boolean", key: "fake_boolean", expected: false },
    ])("should return $type values", ({ key, expected }) => {
      expect(featureFlagStore.get<typeof expected>(key)).toBe(expected);
    });

    it("should accept known feature flags", () => {
      featureFlagStore.initialize(`${"fake_string"}=true`);
      expect(featureFlagStore.get("fake_string")).toBe(true);
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
      featureFlagStore.initialize(`${"fake_boolean"}=true`);
      const value: boolean = featureFlagStore.get("fake_boolean");
      expect(value).toBe(true);
    });
  });

  describe("when initializing feature flags", () => {
    it.each([
      {
        name: "should parse string values",
        envVars: {},
        initializeString: `${"fake_boolean"}=advanced`,
        expectedFeatures: {
          ["fake_boolean"]: "advanced",
        },
      },
      {
        name: "should parse boolean values",
        envVars: {},
        initializeString: `${"fake_string"}=true,${"fake_boolean"}=false`,
        expectedFeatures: {
          ["fake_string"]: true,
          ["fake_boolean"]: false,
        },
      },
      {
        name: "should parse numeric values",
        envVars: {},
        initializeString: `${"fake_string"}=5,${"fake_boolean"}=10.5`,
        expectedFeatures: {
          ["fake_string"]: 5,
          ["fake_boolean"]: 10.5,
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
          [`PEPR_FEATURE_${"fake_string".toUpperCase()}`]: "true",
        },
        initializeString: undefined,
        expectedFeatures: {
          ["fake_string"]: true,
        },
      },
      {
        name: "should load features from string",
        envVars: {},
        initializeString: `${"fake_string"}=true`,
        expectedFeatures: {
          ["fake_string"]: true,
        },
      },
      {
        name: "should allow initialization strings to override environment variables",
        envVars: {
          [`PEPR_FEATURE_${"fake_string".toUpperCase()}`]: "true",
          [`PEPR_FEATURE_${"fake_number".toUpperCase()}`]: "42",
        },
        initializeString: `${"fake_number"}=99,${"fake_boolean"}=new`,
        expectedFeatures: {
          ["fake_string"]: true, // From env
          ["fake_number"]: 99, // Overridden by CLI
          ["fake_boolean"]: "new", // From CLI
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
