// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { resolve } from "path";
import prompts from "prompts";

import { RootCmd } from "../root";
import {
  codeSettings,
  eslint,
  peprTSTemplate,
  genPkgJSON,
  gitignore,
  helloPepr,
  peprPackageJSON,
  prettier,
  readme,
  samplesYaml,
  snippet,
  tsConfig,
} from "./templates";
import { createDir, sanitizeName, write } from "./utils";
import { confirm, PromptOptions, walkthrough } from "./walkthrough";
import { ErrorList } from "../../lib/errors";
import { UUID_LENGTH_LIMIT } from "./enums";

export default function (program: RootCmd): void {
  let response = {} as PromptOptions;
  let pkgOverride = "";
  program
    .command("init")
    .description("Initialize a new Pepr Module")
    .option("--confirm", "Skip verification prompt when creating a new module.")
    .option("--description <string>", "Explain the purpose of the new module.")
    .option("--name <string>", "Set the name of the new module.")
    .option("--skip-post-init", "Skip npm install, git init, and VSCode launch.")
    .option(`--errorBehavior <${ErrorList.join("|")}>`, "Set an errorBehavior.")
    .option(
      "--uuid [string]",
      "Unique identifier for your module with a max length of 36 characters.",
      (uuid: string): string => {
        if (uuid.length > UUID_LENGTH_LIMIT) {
          throw new Error("The UUID must be 36 characters or fewer.");
        }
        return uuid.toLocaleLowerCase();
      },
    )
    .hook("preAction", async thisCommand => {
      // TODO: Overrides for testing. Don't be so gross with Node CLI testing
      // TODO: See pepr/#1140
      if (process.env.TEST_MODE === "true") {
        prompts.inject([
          "pepr-test-module",
          "A test module for Pepr",
          "ignore",
          "static-test",
          "y",
        ]);
        pkgOverride = "file:../pepr-0.0.0-development.tgz";
        response = await walkthrough();
      } else {
        response = await walkthrough(thisCommand.opts());
        Object.entries(response).map(([key, value]) => thisCommand.setOptionValue(key, value));
      }
    })
    .action(async opts => {
      const dirName = sanitizeName(response.name);
      const packageJSON = genPkgJSON(response, pkgOverride);

      const confirmed = await confirm(dirName, packageJSON, peprTSTemplate.path, opts.confirm);

      if (confirmed) {
        console.log("Creating new Pepr module...");

        try {
          await setupProjectStructure(dirName);
          await createProjectFiles(dirName, packageJSON);

          if (!opts.skipPostInit) {
            doPostInitActions(dirName);
          }

          console.log(`New Pepr module created at ${dirName}`);
          console.log(`Open VSCode or your editor of choice in ${dirName} to get started!`);
        } catch (e) {
          if (e instanceof Error) {
            console.error(`Error creating Pepr module:`, e);
          }
          process.exit(1);
        }
      }
    });
}

async function setupProjectStructure(dirName: string): Promise<void> {
  await createDir(dirName);
  await createDir(resolve(dirName, ".vscode"));
  await createDir(resolve(dirName, "capabilities"));
}

async function createProjectFiles(dirName: string, packageJSON: peprPackageJSON): Promise<void> {
  const files = [
    { path: gitignore.path, data: gitignore.data },
    { path: eslint.path, data: eslint.data },
    { path: prettier.path, data: prettier.data },
    { path: packageJSON.path, data: packageJSON.data },
    { path: readme.path, data: readme.data },
    { path: tsConfig.path, data: tsConfig.data },
    { path: peprTSTemplate.path, data: peprTSTemplate.data },
  ];

  const nestedFiles = [
    { dir: ".vscode", path: snippet.path, data: snippet.data },
    { dir: ".vscode", path: codeSettings.path, data: codeSettings.data },
    { dir: "capabilities", path: samplesYaml.path, data: samplesYaml.data },
    { dir: "capabilities", path: helloPepr.path, data: helloPepr.data },
  ];

  for (const file of files) {
    await write(resolve(dirName, file.path), file.data);
  }

  for (const file of nestedFiles) {
    await write(resolve(dirName, file.dir, file.path), file.data);
  }
}

const doPostInitActions = (dirName: string): void => {
  // run npm install from the new directory
  process.chdir(dirName);
  execSync("npm install", {
    stdio: "inherit",
  });

  // setup git
  execSync("git init --initial-branch=main", {
    stdio: "inherit",
  });

  // try to open vscode
  try {
    execSync("code .", {
      stdio: "inherit",
    });
  } catch {
    console.warn("VSCode was not found, IDE will not automatically open.");
  }
};
