// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, expect, describe } from "@jest/globals";
import { execSync } from "child_process";

export function peprInit(){
  const peprAlias = "file:pepr-0.0.0-development.tgz";
  const moduleName = "pepr-test-module"
  
  function verifyModuleCreation(){
    const directoryContents = execSync(`ls -d ${moduleName}`)
    expect(directoryContents.toString()).toContain(`${moduleName}`)
    const actualErrorBehavior = execSync(`grep reject "{moduleName}/package.json"`)
    expect(actualErrorBehavior.toString()).toContain("reject")
    const actualDescription = execSync(`grep asdf ${moduleName}/package.json"`)
    expect(actualDescription.toString()).toContain("asdf")
  }

  it("should display the help menu", () => {
    const output = execSync(`npx --yes ${peprAlias} init --help`);
    expect(output.toString()).toContain("confirm")
    expect(output.toString()).toContain("name")
    expect(output.toString()).toContain("description")
    expect(output.toString()).toContain("errorBehavior")
  });

  it.only("should create a new Pepr project with confirmation from STDIN", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`echo "y" | npx --yes ${peprAlias} init --name ${moduleName} --description asdf --errorBehavior reject`, { stdio:"inherit", encoding: 'utf8' });
    verifyModuleCreation()
  });

  it("should create a new Pepr project with prompt input from STDIN", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`echo "${moduleName}" | npx --yes ${peprAlias} init --description asdf --errorBehavior reject --confirm`, { stdio:"inherit", encoding: 'utf8' });
    verifyModuleCreation()
  });

  it("should create a new Pepr project using input flags", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`npx --yes ${peprAlias} init --name ${moduleName} --description asdf --errorBehavior reject --confirm`);
    verifyModuleCreation()
  });
}

describe("Should test Pepr init", peprInit)

// npx --yes file:pepr-0.0.0-development.tgz init --name pepr-test-module --description asdf --errorBehavior reject --confirm