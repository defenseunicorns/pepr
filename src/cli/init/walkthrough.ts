// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import prompt, { Answers, PromptObject } from "prompts";

import { Errors } from "../../lib/errors";
import { eslint, gitignore, prettier, readme, tsConfig } from "./templates";
import { sanitizeName } from "./utils";

export type InitOptions = Answers<"name" | "description" | "errorBehavior">;

export type PromptOptions = {
  name: string;
  description: string;
  errorBehavior: "audit" | "ignore" | "reject";
};

export type PartialPromptOptions = Partial<PromptOptions>;

export async function walkthrough(opts?: PartialPromptOptions): Promise<PromptOptions> {
  const result = {
    ...(await setName(opts?.name)),
    ...(await setDescription(opts?.description)),
    ...(await setErrorBehavior(opts?.errorBehavior)),
  };
  return result as PromptOptions; //TODO: Type coercion issue
}

export async function setName(name?: string): Promise<Answers<string>> {
  if (name !== undefined) {
    //TODO Validation logic
    return { name };
  }

  const askName: PromptObject = {
    type: "text",
    name: "name",
    message:
      "Enter a name for the new Pepr module. This will create a new directory based on the name.\n",
    validate: async (val: string) => {
      try {
        const name = sanitizeName(val);
        await fs.access(name, fs.constants.F_OK);

        return "A directory with this name already exists";
      } catch (e) {
        return val.length > 2 || "The name must be at least 3 characters long";
      }
    },
  };
  const response = prompt([askName]);
  return response;
  // return prompt([askName]);
}

async function setDescription(description?: string): Promise<Answers<string>> {
  if (description !== undefined) {
    //TODO Validation logic
    return { description };
  }

  const askDescription: PromptObject = {
    type: "text",
    name: "description",
    message: "(Recommended) Enter a description for the new Pepr module.\n",
  };

  return prompt([askDescription]);
}

async function setErrorBehavior(
  errorBehavior?: "audit" | "ignore" | "reject",
): Promise<Answers<string>> {
  if (errorBehavior !== undefined) {
    //TODO validation logic
    return { errorBehavior };
  }

  const askErrorBehavior: PromptObject = {
    type: "select",
    name: "errorBehavior",
    message: "How do you want Pepr to handle errors encountered during K8s operations?",
    choices: [
      {
        title: "Reject the operation",
        value: Errors.reject,
        description:
          "In the event that Pepr is down or other module errors occur, the operation will not be allowed to continue. (Recommended for production.)",
      },
      {
        title: "Ignore",
        value: Errors.ignore,
        description:
          "In the event that Pepr is down or other module errors occur, an entry will be generated in the Pepr Controller Log and the operation will be allowed to continue. (Recommended for development, not for production.)",
        selected: true,
      },
      {
        title: "Log an audit event",
        value: Errors.audit,
        description:
          "Pepr will continue processing and generate an entry in the Pepr Controller log as well as an audit event in the cluster.",
      },
    ],
  };
  return prompt([askErrorBehavior]);
}

export async function confirm(
  dirName: string,
  packageJSON: { path: string; print: string },
  peprTSPath: string,
  skipPrompt?: boolean,
): Promise<boolean> {
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

  if (skipPrompt !== undefined) {
    return skipPrompt;
  }

  const confirm = await prompt({
    type: "confirm",
    name: "confirm",
    message: "Create the new Pepr module?",
    format: val => (val === "y" || val === "yes" ? true : false),
  });

  return !!confirm.confirm;
}
