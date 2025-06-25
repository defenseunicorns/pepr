// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it } from "vitest";
import { execSync } from "child_process";

export function peprInit() {
  it("should create a new Pepr project", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
  });
}
