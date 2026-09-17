// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { Workdir } from "../helpers/workdir";
import ms from "ms";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import { kind } from "kubernetes-fluent-client";

const FILE = path.basename(__filename);
const HERE = __dirname;
const ADMIN_RULES = [
  {
    apiGroups: ["*"],
    resources: ["*"],
    verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
  },
];
const SCOPED_RULES = [
  {
    apiGroups: ["pepr.dev"],
    resources: ["peprstores"],
    verbs: ["create", "get", "patch", "watch"],
  },
  {
    apiGroups: ["apiextensions.k8s.io"],
    resources: ["customresourcedefinitions"],
    verbs: ["patch", "create"],
  },
  { apiGroups: [""], resources: ["namespaces"], verbs: ["watch"] },
  { apiGroups: [""], resources: ["configmaps"], verbs: ["watch"] },
];
const RBAC_CASES = [
  {
    name: "default admin",
    args: "",
    outputDir: "dist-admin",
    warningCount: 1,
    rules: ADMIN_RULES,
    verifyHelm: false,
  },
  {
    name: "scoped",
    args: "--rbac-mode scoped",
    outputDir: "dist-scoped",
    warningCount: 0,
    rules: SCOPED_RULES,
    verifyHelm: true,
  },
];

describe("build RBAC modes", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, ms("60s"));

  describe("builds a module", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--error-behavior reject`,
        `--uuid ${id}`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, ms("2m"));

    it.each(RBAC_CASES)(
      "generates $name RBAC",
      async ({ args, outputDir, warningCount, rules, verifyHelm }) => {
        const build = await pepr.cli(testModule, {
          cmd: `pepr build --output ${outputDir} ${args}`,
        });
        const buildOutput = build.stdout.join("");
        const outputPath = `${testModule}/${outputDir}`;

        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(buildOutput).toContain("K8s resource for the module saved");
        expect(buildOutput.match(/broad cluster-wide permissions/g) ?? []).toHaveLength(
          warningCount,
        );

        const clusterRole = await resource.getK8sObjectByKindAndName<kind.ClusterRole>(
          `${outputPath}/pepr-module-${id}.yaml`,
          "ClusterRole",
          `pepr-${id}`,
        );
        expect(clusterRole?.rules).toEqual(rules);

        if (!verifyHelm) return;

        execSync(`helm template .  > ${outputPath}/helm-template.yaml`, {
          cwd: `${outputPath}/${id}-chart`,
        });
        const helmClusterRole = await resource.getK8sObjectByKindAndName<kind.ClusterRole>(
          `${outputPath}/helm-template.yaml`,
          "ClusterRole",
          `pepr-${id}`,
        );
        expect(helmClusterRole?.rules).toEqual(rules);
      },
      ms("1m"),
    );
  });
});
