// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, it } from "@jest/globals";
import { execSync } from "child_process";

import { cwd } from "./entrypoint.test";

export function peprFormat() {
  beforeAll(()=>{
    console.info("!!!STARTING PEPR-FORMAT TESTS!!!")
  })  

  afterAll(()=>{
    console.info("!!!FINISHED PEPR-FORMAT TESTS!!!")
  })  

  it("should format the Pepr project", () => {
    execSync("npx pepr format", { cwd, stdio: "inherit" });
  });
}
