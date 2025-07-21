// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it } from "vitest";
import { execSync } from "child_process";

export function peprInit() {
  it("should create a new Pepr project", () => {
    const peprAlias = "file://./pepr-0.0.0-development.tgz";
    const args = [
      `--name pepr-test-module`,
      `--description "A test module for Pepr"`,
      `--error-behavior ignore`,
      `--uuid static-test`,
      "--yes",
    ].join(" ");
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init ${args}`, { stdio: "inherit" });
  });
}
