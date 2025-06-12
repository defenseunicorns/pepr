// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it } from "vitest";
import { execSync } from "child_process";

import { cwd } from "./entrypoint.test";

export function peprFormat() {
  it("should format the Pepr project", () => {
    execSync("npx pepr format", { cwd, stdio: "inherit" });
  });
}
