// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect } from "vitest";
import { resolveIgnoreNamespaces } from "./ignoredNamespaces";
describe("resolveIgnoreNamespaces", () => {
  it("should default to empty array if config is empty", () => {
    const result = resolveIgnoreNamespaces();
    expect(result).toEqual([]);
  });
  it("should return the config ignore namespaces", () => {
    const result = resolveIgnoreNamespaces(["payments", "istio-system"]);
    expect(result).toEqual(["payments", "istio-system"]);
  });
  describe("when PEPR_ADDITIONAL_IGNORED_NAMESPACES are provided", () => {
    it("should include additionalIgnoredNamespaces", () => {
      process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES = "uds, project-fox";
      const result = resolveIgnoreNamespaces(["zarf", "lula"]);
      expect(result).toEqual(["uds", "project-fox", "zarf", "lula"]);
    });
  });
});
