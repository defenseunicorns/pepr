// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, expect, describe } from "@jest/globals";
import { execSync } from "child_process";

export function peprInit(){
  it("should display the help menu", () => {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --help`);
    expect(output.toString()).toContain("confirm")
    expect(output.toString()).toContain("name")
    expect(output.toString()).toContain("description")
    expect(output.toString()).toContain("errorBehavior")
  });

  it("should create a new Pepr project with confirmation from STDIN", () => {
    execSync('rm -rf pepr-test-module')
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`echo "y" | npx --yes ${peprAlias} init --name pepr-test-module --description asdf --errorBehavior reject`, { stdio:"inherit", encoding: 'utf8' });

    const directoryContents = execSync("ls -d pepr-test-module")
    expect(directoryContents.toString()).toContain("pepr-test-module")
    const actualErrorBehavior = execSync("grep reject pepr-test-module/package.json")
    expect(actualErrorBehavior.toString()).toContain("reject")
    const actualDescription = execSync("grep asdf pepr-test-module/package.json")
    expect(actualDescription.toString()).toContain("asdf")
  });

  it("should create a new Pepr project with prompt input from STDIN", () => {
    execSync('rm -rf pepr-test-module')
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`echo "pepr-test-module" | npx --yes ${peprAlias} init --description asdf --errorBehavior reject --confirm`, { stdio:"inherit", encoding: 'utf8' });

    const directoryContents = execSync("ls -d pepr-test-module")
    expect(directoryContents.toString()).toContain("pepr-test-module")
    const actualErrorBehavior = execSync("grep reject pepr-test-module/package.json")
    expect(actualErrorBehavior.toString()).toContain("reject")
    const actualDescription = execSync("grep asdf pepr-test-module/package.json")
    expect(actualDescription.toString()).toContain("asdf")
  });

  it("should create a new Pepr project using input flags", () => {
    execSync('rm -rf pepr-test-module')
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    const output = execSync(`npx --yes ${peprAlias} init --name pepr-test-module --description asdf --errorBehavior reject --confirm`
    );

    const directoryContents = execSync("ls -d pepr-test-module")
    expect(directoryContents.toString()).toContain("pepr-test-module")
    const actualErrorBehavior = execSync("grep reject pepr-test-module/package.json")
    expect(actualErrorBehavior.toString()).toContain("reject")
    const actualDescription = execSync("grep asdf pepr-test-module/package.json")
    expect(actualDescription.toString()).toContain("asdf")
  });
}

describe("Should test Pepr init", peprInit)

// npx --yes file:pepr-0.0.0-development.tgz init --name pepr-test-module --description asdf --errorBehavior reject --confirm