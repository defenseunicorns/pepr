// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect, beforeEach } from "vitest";
import { resolveIgnoreNamespaces, getIgnoreNamespaces } from "./ignoredNamespaces";
import { ModuleConfig } from "../types";
import { WebhookIgnore } from "../k8s";

const originalEnv = { ...process.env };

const ignore = (namespaces?: string[]): WebhookIgnore => ({ namespaces });

const baseConfig = (overrides?: Partial<ModuleConfig>): ModuleConfig => ({
  uuid: "test-uuid",
  alwaysIgnore: ignore([]), // default: empty list is fine
  ...overrides,
});

beforeEach(() => {
  process.env = { ...originalEnv };
});

describe("when no configuration is provided", () => {
  it("should return an empty array", () => {
    const result = resolveIgnoreNamespaces();
    expect(result).toEqual([]);
  });
});

describe("when resolveIgnoreNamespaces is called with namespace entries", () => {
  it("should return exactly those namespaces", () => {
    const configuredNamespaces = ["payments", "istio-system"];
    const result = resolveIgnoreNamespaces(configuredNamespaces);
    expect(result).toEqual(configuredNamespaces);
  });
});

describe("when namespaces are set in environment variables", () => {
  beforeEach(() => {
    process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES = "uds, project-fox";
  });

  describe("when resolveIgnoreNamespaces is called with namespaces", () => {
    it("should return environment and config namespaces", () => {
      const configuredNamespaces = ["zarf", "lula"];
      const result = resolveIgnoreNamespaces(configuredNamespaces);
      expect(result).toEqual(["uds", "project-fox", "zarf", "lula"]);
    });
  });

  describe("when resolveIgnoreNamespaces is called without namespaces", () => {
    it("should return environment namespaces", () => {
      const result = resolveIgnoreNamespaces();
      expect(result).toEqual(["uds", "project-fox"]);
    });
  });
});

describe("getIgnoreNamespaces", () => {
  it("should use config.alwaysIgnore.namespaces when non-empty", () => {
    const config = baseConfig({
      alwaysIgnore: { namespaces: ["ns-a", "ns-b"] },
      admission: { alwaysIgnore: { namespaces: ["fb-1"] } },
    });

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(result).toEqual(["ns-a", "ns-b"]);
  });

  it("should use config.admission.alwaysIgnore.namespaces when config.alwaysIgnore.namespaces is empty", () => {
    const config = baseConfig({
      alwaysIgnore: { namespaces: [] },
      admission: { alwaysIgnore: { namespaces: ["fb-a", "fb-b"] } },
    });

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(result).toEqual(["fb-a", "fb-b"]);
  });

  it("should use config.admission.alwaysIgnore.namespaces when config.alwaysIgnore.namespaces is undefined", () => {
    const config = baseConfig({
      // alwaysIgnore present but no namespaces
      alwaysIgnore: { namespaces: undefined },
      admission: { alwaysIgnore: { namespaces: ["fb-only"] } },
    });

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(result).toEqual(["fb-only"]);
  });

  it("should return empty array when both sources are absent/empty", () => {
    const config = baseConfig({
      alwaysIgnore: { namespaces: [] },
      admission: { alwaysIgnore: { namespaces: [] } },
    });

    const result = getIgnoreNamespaces(config as ModuleConfig);

    expect(result).toEqual([]);
  });

  it("should return empty array when entire config is undefined", () => {
    const result = getIgnoreNamespaces(undefined);

    expect(result).toEqual([]);
  });
});
