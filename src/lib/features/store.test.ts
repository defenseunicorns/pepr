// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { featureStore, FeatureStore } from "./store";
import { describe, beforeEach, it, expect } from "vitest";

describe("FeatureStore", () => {
  beforeEach(() => {
    // Reset the feature store before each test
    featureStore.reset();
  });

  describe("parsing feature strings", () => {
    it("correctly parses boolean values", () => {
      featureStore.parseFromString("feature1=true,feature2=false");

      expect(featureStore.get("feature1")).toBe(true);
      expect(featureStore.get("feature2")).toBe(false);
    });

    it("correctly parses numeric values", () => {
      featureStore.parseFromString("level=5,count=10.5");

      expect(featureStore.get("level")).toBe(5);
      expect(featureStore.get("count")).toBe(10.5);
    });

    it("correctly parses string values", () => {
      featureStore.parseFromString("name=value,mode=advanced");

      expect(featureStore.get("name")).toBe("value");
      expect(featureStore.get("mode")).toBe("advanced");
    });

    it("handles empty strings gracefully", () => {
      featureStore.parseFromString("");

      expect(featureStore.getAll()).toEqual({});
    });

    it("handles malformed entries gracefully", () => {
      featureStore.parseFromString("valid=true,novalue=,=noproperty,invalid");

      expect(featureStore.get("valid")).toBe(true);
      expect(featureStore.hasFeature("novalue")).toBe(false);
      expect(featureStore.hasFeature("noproperty")).toBe(false);
    });
  });

  describe("feature access", () => {
    beforeEach(() => {
      featureStore.parseFromString("string=value,number=42,boolean=true");
    });

    it("gets features with correct types", () => {
      expect(featureStore.get<string>("string")).toBe("value");
      expect(featureStore.get<number>("number")).toBe(42);
      expect(featureStore.get<boolean>("boolean")).toBe(true);
    });

    it("returns default value when feature doesn't exist", () => {
      expect(featureStore.get("nonexistent", "default")).toBe("default");
      expect(featureStore.get("nonexistent", 100)).toBe(100);
      expect(featureStore.get("nonexistent", false)).toBe(false);
    });

    it("returns undefined when feature doesn't exist and no default is provided", () => {
      expect(featureStore.get("nonexistent")).toBeUndefined();
    });

    it("correctly reports feature existence", () => {
      expect(featureStore.hasFeature("string")).toBe(true);
      expect(featureStore.hasFeature("nonexistent")).toBe(false);
    });

    it("returns a copy of all features", () => {
      const features = featureStore.getAll();
      expect(features).toEqual({
        string: "value",
        number: 42,
        boolean: true,
      });

      // Verify it's a copy by modifying the returned object
      features.string = "modified";
      expect(featureStore.get("string")).toBe("value"); // Original remains unchanged
    });
  });

  describe("environment variable integration", () => {
    it("loads features from environment variables", () => {
      // Save original process.env
      const originalEnv = { ...process.env };

      try {
        // Set test environment variables
        process.env.PEPR_FEATURE_TEST1 = "true";
        process.env.PEPR_FEATURE_TEST2 = "42";
        process.env.PEPR_FEATURE_TEST3 = "value";

        // Initialize from environment
        featureStore.initFromEnv();

        // Check features were loaded correctly
        expect(featureStore.get("test1")).toBe(true);
        expect(featureStore.get("test2")).toBe(42);
        expect(featureStore.get("test3")).toBe("value");
      } finally {
        // Restore original process.env
        process.env = originalEnv;
      }
    });
  });

  describe("feature count validation", () => {
    beforeEach(() => {
      // Reset the feature store before each test
      featureStore.reset();
    });

    it("allows up to 4 feature flags", () => {
      // Should not throw when adding 4 features
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
      }).not.toThrow();

      // Verify all 4 features were added
      expect(Object.keys(featureStore.getAll()).length).toBe(4);
    });

    it("throws an error when more than 4 feature flags are active", () => {
      // First add 4 features that should not exceed the limit
      featureStore.reset();
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
      }).not.toThrow();

      // Now attempt to add a 5th feature, which should throw
      expect(() => {
        featureStore.parseFromString("feature5=extra");
      }).toThrow("Too many feature flags active: 5 (maximum: 4)");
    });

    it("validates count during direct method calls", () => {
      // Should pass validation with exactly 4 features
      expect(() => {
        featureStore.parseFromString("feature1=true,feature2=false,feature3=42,feature4=test");
        featureStore.validateFeatureCount();
      }).not.toThrow();

      // Reset and create a scenario with too many features
      // We need to bypass the parseFromString validation to test the direct validateFeatureCount call
      featureStore.reset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = FeatureStore.getInstance() as any; // Use 'any' to access private features
      store.features = {
        feature1: true,
        feature2: false,
        feature3: 42,
        feature4: "test",
        feature5: "extra",
      };

      // Now validate that calling validateFeatureCount directly throws the expected error
      expect(() => featureStore.validateFeatureCount()).toThrow(
        "Too many feature flags active: 5 (maximum: 4)",
      );
    });
  });
});
