// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import prompt, { Answers, PromptObject } from "prompts";

import { Errors } from "../../lib/errors";
import { eslint, gitignore, prettier, readme, tsConfig } from "./templates";
import { sanitizeName } from "./utils";

export type InitOptions = Answers<"name" | "description" | "errorBehavior">;

export function walkthrough(): Promise<InitOptions> {
  const askName: PromptObject = {
    type: "text",
    name: "name",
    message:
      "Enter a name for the new Pepr module. This will create a new directory based on the name.\n",
    validate: async val => {
      try {
        const name = sanitizeName(val);
        await fs.access(name, fs.constants.F_OK);

        return "A directory with this name already exists";
      } catch (e) {
        return val.length > 2 || "The name must be at least 3 characters long";
      }
    },
  };

  const askDescription: PromptObject = {
    type: "text",
    name: "description",
    message: "(Recommended) Enter a description for the new Pepr module.\n",
  };

  const askErrorBehavior: PromptObject = {
    type: "select",
    name: "errorBehavior",
    message: "How do you want Pepr to handle errors encountered during K8s operations?",
    choices: [
      {
        title: "Ignore",
        value: Errors.ignore,
        description:
          "Pepr will continue processing and generate an entry in the Pepr Controller log.",
        selected: true,
      },
      {
        title: "Log an audit event",
        value: Errors.audit,
        description:
          "Pepr will continue processing and generate an entry in the Pepr Controller log as well as an audit event in the cluster.",
      },
      {
        title: "Reject the operation",
        value: Errors.reject,
        description: "Pepr will reject the operation and return an error to the client.",
      },
    ],
  };

  return prompt([askName, askDescription, askErrorBehavior]) as Promise<InitOptions>;
}

export async function confirm(
  dirName: string,
  packageJSON: { path: string; print: string },
  peprTSPath: string,
) {
  console.log(`
  To be generated:

    \x1b[1m${dirName}\x1b[0m
    ├── \x1b[1m${eslint.path}\x1b[0m
    ├── \x1b[1m${gitignore.path}\x1b[0m
    ├── \x1b[1m${prettier.path}\x1b[0m
    ├── \x1b[1mcapabilties\x1b[0m
    │   ├── \x1b[1mhello-pepr.samples.yaml\x1b[0m     
    │   └── \x1b[1mhello-pepr.ts\x1b[0m     
    ├── \x1b[1m${packageJSON.path}\x1b[0m
${packageJSON.print.replace(/^/gm, "    │   ")}
    ├── \x1b[1m${peprTSPath}\x1b[0m
    ├── \x1b[1m${readme.path}\x1b[0m
    └── \x1b[1m${tsConfig.path}\x1b[0m
      `);

  const confirm = await prompt({
    type: "confirm",
    name: "confirm",
    message: "Create the new Pepr module?",
  });

  return confirm.confirm;
}
