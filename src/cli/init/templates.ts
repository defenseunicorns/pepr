// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import { inspect } from "util";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { dependencies, scripts, version } from "../../../package.json";
import generatedJSON from "./templates/data.json";
import peprSnippetsJSON from "./templates/pepr.code-snippets.json";
import prettierRCJSON from "./templates/prettierrc.json";
import samplesJSON from "./templates/samples.json";
import tsConfigJSON from "./templates/tsconfig.module.json";
import { sanitizeName } from "./utils";
import { InitOptions } from "./walkthrough";

export function genPkgJSON(opts: InitOptions, pgkVerOverride?: string) {
  // Generate a random UUID for the module based on the module name
  const uuid = uuidv5(opts.name, uuidv4());
  // Generate a name for the module based on the module name
  const name = sanitizeName(opts.name);
  // Make typescript a dev dependency
  const { typescript, "ts-node": tsNode } = dependencies;

  const data = {
    name,
    version: "0.0.1",
    description: opts.description,
    keywords: ["pepr", "k8s", "policy-engine", "pepr-module", "security"],
    pepr: {
      name: opts.name.trim(),
      version,
      uuid: pgkVerOverride ? "static-test" : uuid,
      onError: opts.errorBehavior,
      alwaysIgnore: {
        namespaces: [],
        labels: [],
      },
    },
    scripts: {
      "k3d-setup": scripts["e2e-dev-setup"],
      build: "pepr build",
      start: "pepr dev",
    },
    dependencies: {
      pepr: pgkVerOverride || `^${version}`,
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

export function genPeprTS() {
  return {
    path: "pepr.ts",
    data: generatedJSON.peprTS,
  };
}

export const readme = {
  path: "README.md",
  data: generatedJSON.readme,
};

export const helloPeprTS = {
  path: "hello-pepr.ts",
  data: generatedJSON.helloPeprTS,
};

export const gitIgnore = {
  path: ".gitignore",
  data: generatedJSON.gitignore,
};

export const samplesYaml = {
  path: "hello-pepr.samples.yaml",
  data: samplesJSON.map(r => dumpYaml(r, { noRefs: true })).join("---\n"),
};

export const snippet = {
  path: "pepr.code-snippets",
  data: peprSnippetsJSON,
};

export const tsConfig = {
  path: "tsconfig.json",
  data: tsConfigJSON,
};

export const prettierRC = {
  path: ".prettierrc",
  data: prettierRCJSON,
};
