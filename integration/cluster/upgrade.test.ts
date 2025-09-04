// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { kind, K8s } from "kubernetes-fluent-client";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import { execSync, execFileSync, spawnSync } from "node:child_process";

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
        `--error-behavior reject`,
        `--uuid ${id}`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      execSync(`npx pepr@nightly init ${argz}`, {
        cwd: workdir.path(),
        stdio: "inherit",
      });
    }, time.toMs("2m"));

    it(
      "should prepare, build, and deploy hello-pepr with pepr@latest",
      { timeout: 1000 * 5 * 60 },
      async () => {
        await runWithErrorHandling(async () => {
          await installPepr(testModule, "pepr@latest");
          await buildModule(testModule);
          await applyKubernetesManifest(testModule, id, "create");
          await waitForModuleDeployments(id);
        }, "installation");
      },
    );
  });

  it("should display the UUIDs of the deployed modules with a specific UUID",{ timeout: 1000 * 5 * 60 }, async () => {
    const uuidOut = spawnSync(`npx pepr@latest uuid ${id}`, {
      shell: true, // Run command in a shell
      encoding: "utf-8", // Encode result as string
    });

    const { stdout } = uuidOut;

    const matches = stdout.match(/upgrade-test/g) || [];

    expect(matches.length).toBe(2);
  });

  it(
    "should prepare, build and deploy with pepr@pr-candidate",
    { timeout: 1000 * 10 * 60 },
    async () => {
      await runWithErrorHandling(async () => {
        const image = process.env.PEPR_IMAGE || "pepr:dev";
        const peprTarball = path.resolve(__dirname, "../../pepr-0.0.0-development.tgz");

        await installPepr(testModule, peprTarball);
        await buildModule(testModule, image);
        await applyKubernetesManifest(testModule, id, "apply");

        await resetDeployments(id);
        await waitForModuleDeployments(id);
      }, "pepr@pr-candidate deployment");
    },
  );
});

/**
 * Run a function with standardized error handling
 */
async function runWithErrorHandling(fn: () => Promise<void>, context: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`Error during ${context}:`, error);
    expect(error).toBeNull();
  }
}

/**
 * Install a Pepr version in the test module
 */
async function installPepr(moduleDir: string, peprSource: string): Promise<void> {
  execSync(`npm install "${peprSource}"`, {
    cwd: moduleDir,
    stdio: "inherit",
  });
}

/**
 * Build a Pepr module
 */
async function buildModule(moduleDir: string, image?: string): Promise<void> {
  const imageFlag = image ? `--custom-image ${image}` : "";
  execSync(`./node_modules/pepr/dist/cli.js build ${imageFlag}`.trim(), {
    cwd: moduleDir,
    stdio: "inherit",
  });
}

/**
 * Apply or create the Kubernetes manifest for a Pepr module
 */
async function applyKubernetesManifest(
  moduleDir: string,
  id: string,
  operation: "apply" | "create",
): Promise<void> {
  execFileSync(
    "kubectl",
    [operation, `--filename=${path.join(moduleDir, "dist", `pepr-module-${id}.yaml`)}`],
    {
      cwd: moduleDir,
      stdio: "inherit",
    },
  );
}

/**
 * Reset deployments by scaling down, cleaning up pods, and scaling back up
 */
async function resetDeployments(id: string): Promise<void> {
  execSync(`kubectl scale deployment pepr-${id} --replicas=0 --namespace pepr-system`);
  execSync(`kubectl scale deployment pepr-${id}-watcher --replicas=0 --namespace pepr-system`);
  await K8s(kind.Pod).InNamespace("pepr-system").Delete();
  execSync(`kubectl scale deployment pepr-${id} --replicas=2 --namespace pepr-system`);
  execSync(`kubectl scale deployment pepr-${id}-watcher --replicas=1 --namespace pepr-system`);
}

/**
 * Wait for both Pepr module deployments to be ready
 */
async function waitForModuleDeployments(id: string): Promise<void> {
  await Promise.all([
    waitForDeploymentReady("pepr-system", `pepr-${id}`),
    waitForDeploymentReady("pepr-system", `pepr-${id}-watcher`),
  ]);
}

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
