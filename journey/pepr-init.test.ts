// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, expect, describe } from "@jest/globals";
import { execSync, spawnSync } from "child_process";

export function peprInit(){
  it("should create a new Pepr project", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
  });

  it("should display the input options", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --help`);
    expect(output.toString()).toContain("name")
    expect(output.toString()).toContain("description")
    expect(output.toString()).toContain("errorBehavior")
  });

  it("should print a fun message when --name is set", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --name myTestModule --description asdf --errorBehavior reject`
    );
    console.log(output.toString())
    expect(output.toString()).toContain("mytestmodule")
    expect(output.toString()).toContain("asdf")
    expect(output.toString()).toContain("reject")
  });
}

describe("Should test Pepr init", peprInit)