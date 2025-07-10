// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import { kind } from "kubernetes-fluent-client";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build rbacMode=scoped", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("60s"));

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
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("scoped rbac cluster role", () => {
      const outputDir = `${testModule}/dist`;

      let packageJson;
      let uuid: string;

      beforeAll(async () => {
        const build = await pepr.cli(testModule, { cmd: `pepr build --rbac-mode scoped` });

        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        packageJson = await resource.fromFile(`${testModule}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      it("creates a scoped rbac role to the kubernetes manifests", async () => {
        const clusterRole = await resource.getK8sObjectByKindAndName<kind.ClusterRole>(
          `${outputDir}/pepr-module-${uuid}.yaml`,
          "ClusterRole",
          `pepr-${uuid}`,
        );
        expect(clusterRole).toBeDefined();
        expect(clusterRole!.rules).toEqual([
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
        ]);
      });

      it("creates a scoped rbac clusterrole for the helm chart", async () => {
        execSync(`helm template .  > ${outputDir}/helm-template.yaml`, {
          cwd: `${outputDir}/${uuid}-chart`,
        });
        const clusterRole = await resource.getK8sObjectByKindAndName<kind.ClusterRole>(
          `${outputDir}/helm-template.yaml`,
          "ClusterRole",
          `pepr-${uuid}`,
        );
        expect(clusterRole).toBeDefined();
        expect(clusterRole!.rules).toEqual([
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
        ]);
      });
    });
  });
});
