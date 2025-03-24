// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import prompt, { Answers, PromptObject } from "prompts";

import { eslint, gitignore, prettier, readme, tsConfig } from "./templates";
import { sanitizeName } from "./utils";
import { OnError } from "./enums";
import { ErrorList } from "../../lib/errors";

export type PromptOptions = {
  name: string;
  description: string;
  errorBehavior: OnError;
  uuid: string;
};

export type PartialPromptOptions = Partial<PromptOptions>;

export async function walkthrough(opts?: PartialPromptOptions): Promise<PromptOptions> {
  const result = {
    ...(await setName(opts?.name)),
    ...(await setDescription(opts?.description)),
    ...(await setErrorBehavior(opts?.errorBehavior)),
    ...(await setUUID(opts?.uuid)),
  };
  return result as PromptOptions;
}
async function setUUID(uuid?: string): Promise<Answers<string>> {
  const askUUID: PromptObject = {
    type: "text",
    name: "uuid",
    message: "Enter a unique identifier for the new Pepr module.\n",
    validate: (val: string) => {
      const uuidLengthLimit = 36
      return val.length <= uuidLengthLimit || `The UUID must be ${uuidLengthLimit} characters or fewer.`;
    },
  };

  if (uuid !== undefined) {
    return { uuid };
  }

  return prompt([askUUID]);
}
export async function setName(name?: string): Promise<Answers<string>> {
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
      } catch {
        return val.length > 2 || "The name must be at least 3 characters long";
      }
    },
  };

  if (name !== undefined) {
    if (name.length < 3) {
      console.error(`Module name must be at least 3 characters long. Received '${name}'`);
      const response = prompt([askName]);
      return response;
    } else {
      return { name };
    }
  }

  return prompt([askName]);
}

async function setDescription(description?: string): Promise<Answers<string>> {
  const askDescription: PromptObject = {
    type: "text",
    name: "description",
    message: "(Recommended) Enter a description for the new Pepr module.\n",
  };

  if (description !== undefined) {
    return { description };
  }

  return prompt([askDescription]);
}

export async function setErrorBehavior(errorBehavior?: OnError): Promise<Answers<string>> {
  const askErrorBehavior: PromptObject = {
    type: "select",
    name: "errorBehavior",
    message: "How do you want Pepr to handle errors encountered during K8s operations?",
    choices: [
      {
        title: "Reject the operation",
        value: OnError.REJECT,
        description:
          "In the event that Pepr is down or other module errors occur, the operation will not be allowed to continue. (Recommended for production.)",
      },
      {
        title: "Ignore",
        value: OnError.IGNORE,
        description:
          "In the event that Pepr is down or other module errors occur, an entry will be generated in the Pepr Controller Log and the operation will be allowed to continue. (Recommended for development, not for production.)",
        selected: true,
      },
      {
        title: "Log an audit event",
        value: OnError.AUDIT,
        description:
          "Pepr will continue processing and generate an entry in the Pepr Controller log as well as an audit event in the cluster.",
      },
    ],
  };

  if (errorBehavior !== undefined) {
    if (!ErrorList.includes(errorBehavior)) {
      return prompt([askErrorBehavior]);
    }
    return { errorBehavior };
  }

  return prompt([askErrorBehavior]);
}

export async function confirm(
  dirName: string,
  packageJSON: { path: string; print: string },
  peprTSPath: string,
  skipPrompt?: boolean,
): Promise<boolean> {
  const confirmationPrompt: PromptObject = {
    type: "confirm",
    name: "confirm",
    message: "Create the new Pepr module?",
  };
  const confirmationMessage = `To be generated:

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
  `;

  if (skipPrompt !== undefined) {
    return skipPrompt;
  } else {
    console.log(confirmationMessage);
    const confirm = await prompt([confirmationPrompt]);
    const shouldCreateModule =
      confirm.confirm === "y" || confirm.confirm === "yes" || confirm.confirm === true
        ? true
        : false;
    return shouldCreateModule;
  }
}
