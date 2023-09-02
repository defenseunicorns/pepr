// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ExecutionContext } from "ava";
import { execSync } from "child_process";

export function peprInit(t: ExecutionContext) {
  try {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}
