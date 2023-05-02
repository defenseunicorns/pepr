// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import { inspect } from "util";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { dependencies, scripts, version } from "../../../package.json";
import prettierRCJSON from "./templates/.prettierrc.json";
import samplesJSON from "./templates/capabilities/hello-pepr.samples.json";
import generatedJSON from "./templates/data.json";
import peprSnippetsJSON from "./templates/pepr.code-snippets.json";
import tsConfigJSON from "./templates/tsconfig.module.json";
import { sanitizeName } from "./utils";
import { InitOptions } from "./walkthrough";

/**
 * Generates package.json data object
 * @param opts - InitOptions object
 * @param pgkVerOverride - Optional package version override
 * @returns package.json data object
 */
export function genPkgJSON(opts: InitOptions, pgkVerOverride?: string) {
  const uuid = uuidv5(opts.name, uuidv4()); // Generate a random UUID for the module based on the module name
  const name = sanitizeName(opts.name); // Generate a name for the module based on the module name
  const { typescript, "ts-node": tsNode } = dependencies; // Destructure dependencies

  const data = {
    name,
    version: pgkVerOverride || "0.0.1", // Use package version override if provided, otherwise default to "0.0.1"
    description: opts.description,
    keywords: ["pepr", "k8s", "policy-engine", "pepr-module", "security"],
    pepr: {
      name: opts.name.trim(),
      uuid: pgkVerOverride ? "static-test" : uuid, // Use "static-test" if package version override is provided, otherwise use generated UUID
      onError: opts.errorBehavior,
      alwaysIgnore: {
        namespaces: [],
        labels: [],
      },
    },
    scripts: {
      "k3d-setup": scripts["test:e2e:k3d"],
      build: "pepr build",
      deploy: "pepr deploy",
      start: "pepr dev",
    },
    dependencies: {
      pepr: pgkVerOverride || `${version}`, // Use package version override if provided, otherwise use version from package.json
    },
    devDependencies: {
      typescript,
      "ts-node": tsNode,
    },
  };

  return {
    data,
    path: "package.json",
    print: inspect(data, false, 5, true),
  };
}

/**
 * Generates pepr.ts file data object
 * @returns pepr.ts file data object
 */
export function genPeprTS() {
  return {
    path: "pepr.ts",
    data: generatedJSON.peprTS,
  };
}

/**
 * README.md file data object
 */
export const readme = {
  path: "README.md",
  data: generatedJSON.readme,
};

/**
 * hello-pepr.ts file data object
 */
export const helloPeprTS = {
  path: "hello-pepr.ts",
  data: generatedJSON.helloPeprTS,
};

/**
 * .gitignore file data object
 */
export const gitIgnore = {
  path: ".gitignore",
  data: generatedJSON.gitignore,
};

/**
 * hello-pepr.samples.yaml file data object
 */
export const samplesYaml = {
  path: "hello-pepr.samples.yaml",
  data: samplesJSON.map((r) => dumpYaml(r, { noRefs: true })).join("---\n"),
};

/**
 * pepr.code-snippets file data object
 */
export const snippet = {
  path: "pepr.code-snippets",
  data: peprSnippetsJSON,
};

/**
 * tsconfig.json file data object
 */
export const tsConfig = {
  path: "tsconfig.json",
  data: tsConfigJSON,
};

/**
 * .prettierrc file data object
 */
export const prettierRC = {
  path: ".prettierrc",
  data: prettierRCJSON,
};