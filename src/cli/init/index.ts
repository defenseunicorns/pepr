// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { peprTSTemplate, genPkgJSON } from "./templates";
import { sanitizeName } from "./utils";
import { confirm, PromptOptions, walkthrough } from "./walkthrough";
import { ErrorList } from "../../lib/errors";
import { UUID_LENGTH_LIMIT } from "./enums";
import { Option } from "commander";
import { setupProjectStructure } from "./setupProjectStructure";
import { doPostInitActions } from "./doPostInitActions";
import { createProjectFiles } from "./createProjectFiles";
import { v4 as uuidv4 } from "uuid";
import Log from "../../lib/telemetry/logger";

export default function (): Command {
  let response = {} as PromptOptions;

  return new Command("init")
    .description("Initialize a new Pepr Module")
    .option("-d, --description <string>", "Explain the purpose of the new module.")
    .addOption(
      new Option("-e, --error-behavior <behavior>", "Set an error behavior.").choices(ErrorList),
    )
    .option("-n, --name <string>", "Set the name of the new module.")
    .option("-s, --skip-post-init", "Skip npm install, git init, and VSCode launch.")
    .option(
      "-u, --uuid <string>",
      "Unique identifier for your module with a max length of 36 characters.",
      (uuid: string): string => {
        if (typeof uuid === "undefined" || uuid === "") {
          uuid = uuidv4();
          Log.warn(`The UUID was empty. Generated new UUID: '${uuid}'`);
        }
        if (uuid.length > UUID_LENGTH_LIMIT) {
          throw new Error("The UUID must be 36 characters or fewer.");
        }
        return uuid.toLocaleLowerCase();
      },
    )
    .option("-y, --yes", "Skip verification prompt when creating a new module.")
    .hook("preAction", async thisCommand => {
      response = await walkthrough(thisCommand.opts());
      Object.entries(response).map(([key, value]) => thisCommand.setOptionValue(key, value));
    })
    .action(async opts => {
      const dirName = sanitizeName(response.name);
      const packageJSON = genPkgJSON(response);

      const confirmed = await confirm(dirName, packageJSON, peprTSTemplate.path, opts.yes);

      if (confirmed) {
        Log.info("Creating new Pepr module...");

        try {
          await setupProjectStructure(dirName);
          await createProjectFiles(dirName, packageJSON);

          if (!opts.skipPostInit) {
            doPostInitActions(dirName);
          }

          Log.info(`New Pepr module created at ${dirName}`);
          Log.info(`Open VSCode or your editor of choice in ${dirName} to get started!`);
        } catch (error) {
          throw new Error(`Error creating Pepr module:`, { cause: error });
        }
      }
    });
}
