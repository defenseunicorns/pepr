// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { resolve } from "path";
import prompts from "prompts";

import { RootCmd } from "../root";
import {
  codeSettings,
  eslint,
  genPeprTS,
  genPkgJSON,
  gitignore,
  helloPepr,
  prettier,
  readme,
  samplesYaml,
  snippet,
  tsConfig,
} from "./templates";
import { createDir, sanitizeName, write } from "./utils";
import { confirm, PromptOptions, walkthrough } from "./walkthrough";
import { ErrorList } from "../../lib/errors";
import { OnError } from "./enums";

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
    .option(`--errorBehavior <${ErrorList.join("|")}>`, "Set an errorBehavior.", OnError.REJECT)
    .hook("preAction", async thisCommand => {
      // TODO: Overrides for testing. Don't be so gross with Node CLI testing
      // TODO: See pepr/#1140
      if (process.env.TEST_MODE === "true") {
        prompts.inject(["pepr-test-module", "A test module for Pepr", "ignore", "y"]);
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
      const peprTS = genPeprTS();

      const confirmed = await confirm(dirName, packageJSON, peprTS.path, opts.confirm);

      if (confirmed) {
        console.log("Creating new Pepr module...");

        try {
          await createDir(dirName);
          await createDir(resolve(dirName, ".vscode"));
          await createDir(resolve(dirName, "capabilities"));

          await write(resolve(dirName, gitignore.path), gitignore.data);
          await write(resolve(dirName, eslint.path), eslint.data);
          await write(resolve(dirName, prettier.path), prettier.data);
          await write(resolve(dirName, packageJSON.path), packageJSON.data);
          await write(resolve(dirName, readme.path), readme.data);
          await write(resolve(dirName, tsConfig.path), tsConfig.data);
          await write(resolve(dirName, peprTS.path), peprTS.data);
          await write(resolve(dirName, ".vscode", snippet.path), snippet.data);
          await write(resolve(dirName, ".vscode", codeSettings.path), codeSettings.data);
          await write(resolve(dirName, "capabilities", samplesYaml.path), samplesYaml.data);
          await write(resolve(dirName, "capabilities", helloPepr.path), helloPepr.data);

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
