// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ExecutionContext } from "ava";
import { execSync } from "child_process";

import { cwd } from "./entrypoint.test";

export function peprFormat(t: ExecutionContext) {
  try {
    execSync("npx pepr format", { cwd, stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}
