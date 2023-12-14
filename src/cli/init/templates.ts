// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import { inspect } from "util";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";

import eslintJSON from "../../templates/.eslintrc.template.json";
import prettierJSON from "../../templates/.prettierrc.json";
import samplesJSON from "../../templates/capabilities/hello-pepr.samples.json";
import { gitIgnore, helloPeprTS, packageJSON, peprTS, readmeMd } from "../../templates/data.json";
import peprSnippetsJSON from "../../templates/pepr.code-snippets.json";
import settingsJSON from "../../templates/settings.json";
import tsConfigJSON from "../../templates/tsconfig.module.json";
import { sanitizeName } from "./utils";
import { InitOptions } from "./walkthrough";

export const { dependencies, devDependencies, peerDependencies, scripts, version } = packageJSON;

export function genPkgJSON(opts: InitOptions, pgkVerOverride?: string) {
  // Generate a random UUID for the module based on the module name
  const uuid = uuidv5(opts.name, uuidv4());
  // Generate a name for the module based on the module name
  const name = sanitizeName(opts.name);
  // Make typescript a dev dependency
  const { typescript } = peerDependencies;

  const testEnv = {
    MY_CUSTOM_VAR: "example-value",
    ZARF_VAR: "###ZARF_VAR_THING###",
  };

  const data = {
    name,
    version: "0.0.1",
    description: opts.description,
    keywords: ["pepr", "k8s", "policy-engine", "pepr-module", "security"],
    engines: {
      node: ">=18.0.0",
    },
    pepr: {
      name: opts.name.trim(),
      uuid: pgkVerOverride ? "static-test" : uuid,
      onError: opts.errorBehavior,
      alwaysIgnore: {
        namespaces: [],
        labels: [],
      },
      includedFiles: [],
      env: pgkVerOverride ? testEnv : {},
    },
    scripts: {
      "k3d-setup": scripts["test:journey:k3d"],
    },
    dependencies: {
      pepr: pgkVerOverride || version,
    },
    devDependencies: {
      typescript,
    },
  };

  return {
    data,
    path: "package.json",
    print: inspect(data, false, 5, true),
  };
}

export function genPeprTS() {
  return {
    path: "pepr.ts",
    data: peprTS,
  };
}

export const readme = {
  path: "README.md",
  data: readmeMd,
};

export const helloPepr = {
  path: "hello-pepr.ts",
  data: helloPeprTS,
};

export const gitignore = {
  path: ".gitignore",
  data: gitIgnore,
};

export const samplesYaml = {
  path: "hello-pepr.samples.yaml",
  data: samplesJSON.map(r => dumpYaml(r, { noRefs: true })).join("---\n"),
};

export const snippet = {
  path: "pepr.code-snippets",
  data: peprSnippetsJSON,
};

export const codeSettings = {
  path: "settings.json",
  data: settingsJSON,
};

export const tsConfig = {
  path: "tsconfig.json",
  data: tsConfigJSON,
};

export const prettier = {
  path: ".prettierrc",
  data: prettierJSON,
};

export const eslint = {
  path: ".eslintrc.json",
  data: eslintJSON,
};
