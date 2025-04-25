// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { kind } from "kubernetes-fluent-client";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
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
        `--errorBehavior reject`,
        `--uuid random-identifier`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("using non-conflicting build override options", () => {
      const entryPoint = "pepr2.ts";
      const customImage = "pepr:override";
      const outputDir = `${testModule}/out`;
      const timeout = 11;
      const withPullSecret = "shhh";
      const zarf = "chart";

      let packageJson;
      let uuid: string;

      beforeAll(async () => {
        await fs.rename(`${testModule}/pepr.ts`, `${testModule}/${entryPoint}`);

        const argz = [
          `--entry-point ${entryPoint}`,
          `--custom-image ${customImage}`,
          `--output-dir ${outputDir}`,
          `--timeout ${timeout}`,
          `--withPullSecret ${withPullSecret}`,
          `--zarf ${zarf}`,
        ].join(" ");
        const build = await pepr.cli(testModule, { cmd: `pepr build ${argz}` });

        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        packageJson = await resource.fromFile(`${testModule}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      const getDepConImg = (deploy: kind.Deployment, container: string): string => {
        return deploy!
          .spec!.template!.spec!.containers.filter(cont => cont.name === container)
          .at(0)!.image!;
      };

      it("--entry-point, works", async () => {
        // build would fail if given entrypoint didn't exist, so... no-op test!
      });

      it("--output-dir, works", async () => {
        const dist = `${testModule}/dist`;
        expect(existsSync(dist)).toBe(false);

        expect(existsSync(outputDir)).toBe(true);
      });

      it("--custom-image, works", async () => {
        const moduleYaml = await resource.fromFile(`${outputDir}/pepr-module-${uuid}.yaml`);
        {
          const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
          const admissionImage = getDepConImg(admission, "server");
          expect(admissionImage).toBe(customImage);

          const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
          const watcherImage = getDepConImg(watcher, "watcher");
          expect(watcherImage).toBe(customImage);
        }

        const zarfYaml = await resource.fromFile(`${outputDir}/zarf.yaml`);
        {
          const componentImage = zarfYaml.components.at(0).images.at(0);
          expect(componentImage).toBe(customImage);
        }

        const valuesYaml = await resource.fromFile(`${outputDir}/${uuid}-chart/values.yaml`);
        {
          const admissionImage = valuesYaml.admission.image;
          expect(admissionImage).toBe(customImage);

          const watcherImage = valuesYaml.watcher.image;
          expect(watcherImage).toBe(customImage);
        }
      });

      it("--timeout, works", async () => {
        const moduleYaml = await resource.fromFile(`${outputDir}/pepr-module-${uuid}.yaml`);
        {
          const mwc = resource.select(
            moduleYaml,
            kind.MutatingWebhookConfiguration,
            `pepr-${uuid}`,
          );
          const webhook = mwc
            .webhooks!.filter(hook => hook.name === `pepr-${uuid}.pepr.dev`)
            .at(0)!;
          expect(webhook.timeoutSeconds).toBe(timeout);
        }
        {
          const mwc = resource.select(
            moduleYaml,
            kind.ValidatingWebhookConfiguration,
            `pepr-${uuid}`,
          );
          const webhook = mwc
            .webhooks!.filter(hook => hook.name === `pepr-${uuid}.pepr.dev`)
            .at(0)!;
          expect(webhook.timeoutSeconds).toBe(timeout);
        }

        const valuesYaml = await resource.fromFile(`${outputDir}/${uuid}-chart/values.yaml`);
        expect(valuesYaml.admission.webhookTimeout).toBe(timeout);
      });

      it("--withPullSecret, works", async () => {
        const getDepImgPull = (deploy: kind.Deployment): string[] => {
          return deploy!.spec!.template!.spec!.imagePullSecrets!.map(
            imagePullSecret => imagePullSecret.name!,
          );
        };

        const moduleYaml = await resource.fromFile(`${outputDir}/pepr-module-${uuid}.yaml`);

        const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
        const admissionSecrets = getDepImgPull(admission);
        expect(admissionSecrets).toEqual([withPullSecret]);

        const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
        const watcherSecrets = getDepImgPull(watcher);
        expect(watcherSecrets).toEqual([withPullSecret]);

        const valuesYaml = await resource.fromFile(`${outputDir}/${uuid}-chart/values.yaml`);
        expect(valuesYaml.imagePullSecrets).toContain(withPullSecret);
      });

      it("--zarf, works", async () => {
        const chart = {
          name: "pepr-random-identifier",
          namespace: "pepr-system",
          version: "0.0.1",
          localPath: `${uuid}-chart`,
        };

        const zarfYaml = await resource.fromFile(`${outputDir}/zarf.yaml`);
        const component = zarfYaml.components
          .filter((component: { name: string }) => component.name === "pepr-random-identifier")
          .at(0);
        expect(component.charts).toContainEqual(chart);
      });
    });
  });
});
