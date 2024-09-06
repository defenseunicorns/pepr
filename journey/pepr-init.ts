// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, expect, describe } from "@jest/globals";
import { exec, execSync, spawn, spawnSync } from "child_process";

export function peprInit(){
  it("should display the help menu", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --help`);
    expect(output.toString()).toContain("confirm")
    expect(output.toString()).toContain("name")
    expect(output.toString()).toContain("description")
    expect(output.toString()).toContain("errorBehavior")
  });

  it("should create a new Pepr project with input from STDIN", () => {
    execSync('rm -rf pepr-test-module')
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --name pepr-test-module --description testDesc --errorBehavior reject`, { stdio:[ "pipe", "pipe", "inherit"], encoding: 'utf8', input: "y\n" });
    //TODO: Assert on filesystem
    expect(output.toString()).toContain("'pepr-test-module'");
    expect(output.toString()).toContain("'testDesc'");
    expect(output.toString()).toContain("'reject'");
  });

  it("should create a new Pepr project using input flags", () => {
    execSync('rm -rf pepr-test-module')
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --name pepr-test-module --description asdf --errorBehavior reject --confirm`
    );
    //TODO: Assert on filesystem
    expect(output.toString()).toContain("pepr-test-module")
    expect(output.toString()).toContain("asdf")
    expect(output.toString()).toContain("reject")
  });
}

// describe("Should test Pepr init", peprInit)