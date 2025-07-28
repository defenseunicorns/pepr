// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, beforeEach, it, expect } from "vitest";
import { createCRDscaffold } from "./createCRDscaffold";

describe("generateCRDScaffold", () => {
  // Common test data
  const group = "example";
  const version = "v1alpha1";
  const kind = "MyCustomResource";
  const data = {
    domain: "example.com",
    plural: "mycustomresources",
    scope: "Namespaced",
    shortName: "mcr",
  };

  describe("when generating a CRD scaffold with valid inputs", () => {
    let result: string;

    beforeEach(() => {
      result = createCRDscaffold(group, version, kind, data);
    });

    it("should include type definitions for spec and status", () => {
      expect(result).toContain(`${kind}Spec`);
      expect(result).toContain(`${kind}Status`);
    });

    it("should include group and version metadata as comments", () => {
      expect(result).toContain(`// Group: ${group}`);
      expect(result).toContain(`// Version: ${version}`);
    });

    it("should include domain in comments", () => {
      expect(result).toContain(`// Domain: ${data.domain}`);
    });

    it("should configure CRD metadata correctly", () => {
      expect(result).toContain(`plural: "${data.plural}"`);
      expect(result).toContain(`scope: "${data.scope}"`);
      expect(result).toContain(`shortName: "${data.shortName}"`);
    });

    it("should include status condition types", () => {
      expect(result).toContain(`${kind}StatusCondition`);
      expect(result).toContain(`${kind}Status`);
    });
  });
});
