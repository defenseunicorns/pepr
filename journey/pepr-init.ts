// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, expect } from "@jest/globals";
import { execSync } from "child_process";

export function peprInit(){
  const peprAlias = "file:pepr-0.0.0-development.tgz";
  const moduleName = "pepr-test-module"
  const description = "\"A test module for Pepr\""
  const errorBehavior = "reject"
  
  function verifyModuleCreation(){
    const directoryContents = execSync(`ls -d ${moduleName}`)
    expect(directoryContents.toString()).toContain(`${moduleName}`)
    const actualErrorBehavior = execSync(`grep ${errorBehavior} "${moduleName}/package.json"`)
    expect(actualErrorBehavior.toString()).toContain(`${errorBehavior}`)
    const actualDescription = execSync(`grep ${description} "${moduleName}/package.json"`)
    expect(actualDescription.toString()).toContain(`${description}`)
  }

  it("should display the help menu", () => {
    const output = execSync(`npx --yes ${peprAlias} init --help`);
    expect(output.toString()).toContain("--confirm")
    expect(output.toString()).toContain("--name")
    expect(output.toString()).toContain("--description")
    expect(output.toString()).toContain("--errorBehavior")
  });

  it("should create a new Pepr project with confirmation from STDIN", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`echo "y" | npx --yes ${peprAlias} init --name ${moduleName} --description ${description} --errorBehavior ${errorBehavior}`, { stdio:"inherit", encoding: 'utf8' });
    verifyModuleCreation()
  });

  it("should create a new Pepr project with prompt input from STDIN", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`echo "${moduleName}" | npx --yes ${peprAlias} init --description ${description} --errorBehavior ${errorBehavior} --confirm`, { stdio:"inherit", encoding: 'utf8' });
    verifyModuleCreation()
  });

  it("should create a new Pepr project using input flags", () => {
    execSync(`rm -rf ${moduleName}`)
    execSync(`npx --yes ${peprAlias} init --name ${moduleName} --description ${description} --errorBehavior ${errorBehavior} --confirm`);
    verifyModuleCreation()
  });
}