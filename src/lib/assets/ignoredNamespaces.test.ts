// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect, beforeEach } from "vitest";
import { resolveIgnoreNamespaces } from "./ignoredNamespaces";

const originalEnv = { ...process.env };

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
