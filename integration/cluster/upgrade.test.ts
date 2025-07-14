// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { kind, K8s } from "kubernetes-fluent-client";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import { execSync } from "node:child_process";
const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cluster`);
  const id = "upgrade-test";
  const testModule = `${workdir.path()}/${id}`;

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("1m"));

  describe("builds a module", () => {
    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        `--uuid ${id}`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      execSync(`npx pepr@latest init ${argz}`, {
        cwd: workdir.path(),
        stdio: "inherit",
      });
    }, time.toMs("2m"));

    it(
      "should prepare, build, and deploy hello-pepr with pepr@latest",
      { timeout: 1000 * 5 * 60 },
      async () => {
        try {
          execSync(`npm i pepr@latest`, { cwd: testModule, stdio: "inherit" });
          execSync(`node ./node_modules/pepr/dist/cli.js build`, {
            cwd: testModule,
            stdio: "inherit",
          });

          execSync(`kubectl create -f ${testModule}/dist/pepr-module-${id}.yaml`, {
            cwd: testModule,
            stdio: "inherit",
          });

          await Promise.all([
            waitForDeploymentReady("pepr-system", `pepr-${id}`),
            waitForDeploymentReady("pepr-system", `pepr-${id}-watcher`),
          ]);
        } catch (error) {
          console.error("Error during installation:", error);
          expect(error).toBeNull();
        }
      },
    );
  });

  it(
    "should prepare, build and deploy with pepr@pr-candidate",
    { timeout: 1000 * 10 * 60 },
    async () => {
      try {
        const image = process.env.PEPR_IMAGE || "pepr:dev";
        execSync(`ls  ../../../../../src/`, {
          cwd: testModule,
          stdio: "inherit",
        });
        execSync(`npx --yes tsx ../../../../../src/cli.ts build -i ${image}`, {
          cwd: testModule,
          stdio: "inherit",
        });
        execSync(`kubectl apply -f ${testModule}/dist/pepr-module-${id}.yaml`, {
          cwd: testModule,
          stdio: "inherit",
        });

        // make sure pods go back down before we wait for the deployment be ready
        execSync(`kubectl scale deployment pepr-${id} --replicas=0 -n pepr-system`);
        execSync(`kubectl scale deployment pepr-${id}-watcher --replicas=0 -n pepr-system`);
        await K8s(kind.Pod).InNamespace("pepr-system").Delete();
        execSync(`kubectl scale deployment pepr-${id} --replicas=2 -n pepr-system`);
        execSync(`kubectl scale deployment pepr-${id}-watcher --replicas=1 -n pepr-system`);

        await Promise.all([
          waitForDeploymentReady("pepr-system", `pepr-${id}`),
          waitForDeploymentReady("pepr-system", `pepr-${id}-watcher`),
        ]);
      } catch (error) {
        console.error("Error during pepr@pr-candidate deployment:", error);
        expect(error).toBeNull();
      }
    },
  );
});

export async function waitForDeploymentReady(namespace: string, name: string): Promise<void> {
  const deployment = await K8s(kind.Deployment).InNamespace(namespace).Get(name);
  const replicas = deployment.spec?.replicas || 1;
  const readyReplicas = deployment.status?.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await sleep(2);
    return waitForDeploymentReady(namespace, name);
  }
}

export function sleep(seconds: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
