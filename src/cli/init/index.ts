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
import { confirm, FinalPromptOptions, PromptOptions, walkthrough } from "./walkthrough";
import { ErrorList} from "../../lib/errors";

export default function (program: RootCmd) {
  let response = {} as PromptOptions; //TODO kludge

  program
    .command("init")
    .description("Initialize a new Pepr Module")
    .option("--skip-post-init", "Skip npm install, git init, and VSCode launch")
    .option("--name <string>", "Set a name!")
    .option("--description <string>", "Set a description!")
    .option(`--errorBehavior [${ErrorList}]`, "Set a errorBehavior!")
    .hook('preAction', async (thisCommand) => {
      response = await walkthrough(thisCommand.opts());
      Object.entries(response).map(([key, value]) => thisCommand.setOptionValue(key, value))
    })
    .action(async opts => {
      const pkgOverride = "";
      const dirName = sanitizeName(response.name as string); //TODO: kludge
      const packageJSON = genPkgJSON(
        response as FinalPromptOptions,  //TODO: kludge
        pkgOverride);
      const peprTS = genPeprTS();

      const confirmed = await confirm(dirName, packageJSON, peprTS.path);

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
            // run npm install from the new directory
            process.chdir(dirName);
            execSync("npm install", {
              stdio: "inherit",
            });

            // setup git
            execSync("git init", {
              stdio: "inherit",
            });

            // try to open vscode
            try {
              execSync("code .", {
                stdio: "inherit",
              });
            } catch (e) {
              // vscode not found, do nothing
            }
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
