// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, jest, beforeEach } from "@jest/globals";
import { validateScope, generateCRDScaffold } from "./create";

describe("generateCRDScaffold", () => {
  it("should generate the correct CRD scaffold", () => {
    const group = "example";
    const version = "v1alpha1";
    const kind = "MyCustomResource";
    const data = {
      domain: "example.com",
      plural: "mycustomresources",
      scope: "Namespaced",
      shortName: "mcr",
    };

    const result = generateCRDScaffold(group, version, kind, data);
    expect(result).toContain(`${kind}Spec`);
    expect(result).toContain(`${kind}Status`);
    expect(result).toContain(`// Group: ${group}`);
    expect(result).toContain(`// Version: ${version}`);
    expect(result).toContain(`// Domain: ${data.domain}`);
    expect(result).toContain(`plural: "${data.plural}"`);
    expect(result).toContain(`scope: "${data.scope}"`);
    expect(result).toContain(`shortName: "${data.shortName}"`);
  });
});

describe("validateScope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the scope if it is valid - Cluster", () => {
    const result = validateScope("Cluster");
    expect(result).toBe("Cluster");
  });

  it("should return the scope if it is valid - Namespaced", () => {
    const result = validateScope("Namespaced");
    expect(result).toBe("Namespaced");
  });

  it("should throw an error if the scope is invalid", () => {
    expect(() => validateScope("InvalidScope")).toThrow(
      "Scope must be either 'Cluster' or 'Namespaced'",
    );
  });
});
