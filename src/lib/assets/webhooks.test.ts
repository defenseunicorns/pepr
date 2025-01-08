// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect } from "@jest/globals";
import { resolveIgnoreNamespaces } from "./webhooks";

describe("resolveIgnoreNamespaces", () => {
  it("should default to empty array ig config is empty", () => {
    const result = resolveIgnoreNamespaces();
    expect(result).toEqual([]);
  });

  it("should return the config ignore namespaces if not provided PEPR_ADDITIONAL_IGNORED_NAMESPACES is not provided", () => {
    const result = resolveIgnoreNamespaces(["payments", "istio-system"]);
    expect(result).toEqual(["payments", "istio-system"]);
  });

  it("should include additionalIgnoredNamespaces when PEPR_ADDITIONAL_IGNORED_NAMESPACES is provided", () => {
    process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES = "uds, project-fox";
    const result = resolveIgnoreNamespaces(["zarf", "lula"]);
    expect(result).toEqual(["uds", "project-fox", "zarf", "lula"]);
  });
});
