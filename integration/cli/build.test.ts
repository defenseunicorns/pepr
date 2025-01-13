// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { kind } from "kubernetes-fluent-client";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import * as file from "../helpers/file";

const FILE = path.basename(__filename);
const HERE = __dirname;

const getDepConImg = (deploy: kind.Deployment, container: string): string => {
  return deploy!.spec!.template!.spec!.containers.filter(f => f.name === container).at(0)!.image!;
};

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  });

  it(
    "gives command line help",
    async () => {
      const argz = "--help";
      const res = await pepr.cli(workdir.path(), { cmd: `pepr build ${argz}` });
      expect(res.exitcode).toBe(0);
      expect(res.stderr.join("").trim()).toBe("");
      expect(res.stdout.at(0)).toMatch("Usage: pepr build");
    },
    time.toMs("2m"),
  );

  describe("builds a module", () => {
    const moduleSrc = `${workdir.path()}/module`;

    beforeAll(async () => {
      await fs.rm(moduleSrc, { recursive: true, force: true });
      const argz = [
        `--name module`,
        `--description description`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(moduleSrc);
    }, time.toMs("2m"));

    describe("using default build options", () => {
      it(
        "succeeds",
        async () => {
          const moduleDst = `${workdir.path()}/defaults`;
          await pepr.copyModule(moduleSrc, moduleDst);
          await pepr.cli(moduleDst, { cmd: `npm install` });

          const build = await pepr.cli(moduleDst, { cmd: `pepr build` });
          expect(build.exitcode).toBe(0);
          expect(build.stderr.join("").trim()).toBe("");
          expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");
        },
        time.toMs("1m"),
      );
    });

    describe("for use as a library", () => {
      const moduleDst = `${workdir.path()}/noembed`;
      let packageJson;
      let uuid: string;

      beforeAll(async () => {
        await pepr.copyModule(moduleSrc, moduleDst);
        await pepr.cli(moduleDst, { cmd: `npm install` });

        const argz = [`--no-embed`].join(" ");
        const build = await pepr.cli(moduleDst, { cmd: `pepr build ${argz}` });
        expect(build.exitcode).toBe(0);

        // TODO: team talk
        // Should this be writing to stderr? Even with a 0 exit code..?
        expect(build.stderr.join("").trim()).toContain("Error: Cannot find module");
        // TODO: end

        expect(build.stdout.join("").trim()).toContain("");

        packageJson = await resource.oneFromFile(`${moduleDst}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      it("--no-embed, works", async () => {
        // deployable module files
        {
          const paths = [
            `${moduleDst}/dist/pepr-${uuid}.js`,
            `${moduleDst}/dist/pepr-${uuid}.js.map`,
            `${moduleDst}/dist/pepr-${uuid}.js.LEGAL.txt`,
            `${moduleDst}/dist/pepr-module-${uuid}.yaml`,
          ];
          for (const path of paths) {
            // await expect(fs.access(path)).rejects.toThrowError("no such file or directory");
            expect(await file.exists(path)).toBe(false);
          }
        }

        // zarf manifest
        {
          const path = `${moduleDst}/dist/zarf.yaml`;
          expect(await file.exists(path)).toBe(false);
        }

        // helm chart
        {
          const path = `${moduleDst}/dist/${uuid}-chart/`;
          expect(await file.exists(path)).toBe(false);
        }

        // importable module files
        {
          const paths = [
            `${moduleDst}/dist/pepr.js`,
            `${moduleDst}/dist/pepr.js.map`,
            `${moduleDst}/dist/pepr.js.LEGAL.txt`,
          ];
          for (const path of paths) {
            expect(await file.exists(path)).toBe(true);
          }
        }
      });
    });

    describe("using a custom registry", () => {
      const moduleDst = `${workdir.path()}/reginfo`;
      let packageJson;
      let uuid: string;
      const registryInfo = "registry.io/username";

      beforeAll(async () => {
        await pepr.copyModule(moduleSrc, moduleDst);
        await pepr.cli(moduleDst, { cmd: `npm install` });

        const argz = [`--registry-info ${registryInfo}`].join(" ");
        const build = await pepr.cli(moduleDst, { cmd: `pepr build ${argz}` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        packageJson = await resource.oneFromFile(`${moduleDst}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      it("--registry-info, works", async () => {
        // overwrites --custom-image..?
        const image = `${registryInfo}/custom-pepr-controller:0.0.0-development`;

        const moduleYaml = await resource.manyFromFile(
          `${moduleDst}/dist/pepr-module-${uuid}.yaml`,
        );
        {
          const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
          const admissionImage = getDepConImg(admission, "server");
          expect(admissionImage).toBe(image);

          const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
          const watcherImage = getDepConImg(watcher, "watcher");
          expect(watcherImage).toBe(image);
        }

        const zarfYaml = await resource.oneFromFile(`${moduleDst}/dist/zarf.yaml`);
        {
          const componentImage = zarfYaml.components.at(0).images.at(0);
          expect(componentImage).toBe(image);
        }

        const valuesYaml = await resource.oneFromFile(
          `${moduleDst}/dist/${uuid}-chart/values.yaml`,
        );
        {
          const admissionImage = valuesYaml.admission.image;
          expect(admissionImage).toBe(image);

          const watcherImage = valuesYaml.watcher.image;
          expect(watcherImage).toBe(image);
        }
      });
    });

    describe("using a specified pepr version", () => {
      const moduleDst = `${workdir.path()}/version`;
      const cliVersion = "0.0.0-development";
      const version = "1.2.3";

      beforeAll(async () => {
        await pepr.copyModule(moduleSrc, moduleDst);
        await pepr.cli(moduleDst, { cmd: `npm install` });

        const argz = [`--version ${version}`].join(" ");
        const build = await pepr.cli(moduleDst, { cmd: `pepr build ${argz}` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain(cliVersion);
      }, time.toMs("1m"));

      it.only("--version, is broken..?", async () => {
        // looks like it's just giving back the `pepr --version` then exiting,
        //  rather than buidling/affecting the output files at all..?
        expect(await file.exists(`${moduleDst}/dist`)).toBe(false);
      });
    });

    describe("using non-conflicting build override options", () => {
      const moduleDst = `${workdir.path()}/overrides`;
      let packageJson;
      let uuid: string;
      const overrides = {
        entryPoint: "pepr2.ts",
        customImage: "pepr:override",
        outputDir: `${moduleDst}/out`,
        timeout: 11,
      };

      beforeAll(async () => {
        //
        // prepare module
        //
        await pepr.copyModule(moduleSrc, moduleDst);
        await pepr.cli(moduleDst, { cmd: `npm install` });

        //
        // establish override-support conditions
        //
        await fs.rename(`${moduleDst}/pepr.ts`, `${moduleDst}/${overrides.entryPoint}`);

        //
        // use overrides
        //
        const argz = [
          `--entry-point ${overrides.entryPoint}`,
          `--custom-image ${overrides.customImage}`,
          `--output-dir ${overrides.outputDir}`,
          `--timeout ${overrides.timeout}`,
        ].join(" ");
        const build = await pepr.cli(moduleDst, { cmd: `pepr build ${argz}` });

        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        packageJson = await resource.oneFromFile(`${moduleDst}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      it("--entry-point, works", async () => {
        // build would fail if given entrypoint didn't exist, so... no-op, right?
      });

      it("--output-dir, works", async () => {
        const dist = `${moduleDst}/dist`;
        expect(await file.exists(dist)).toBe(false);

        const out = overrides.outputDir;
        expect(await file.exists(out)).toBe(true);
      });

      it("--custom-image, works", async () => {
        const moduleYaml = await resource.manyFromFile(
          `${overrides.outputDir}/pepr-module-${uuid}.yaml`,
        );
        {
          const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
          const admissionImage = getDepConImg(admission, "server");
          expect(admissionImage).toBe(overrides.customImage);

          const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
          const watcherImage = getDepConImg(watcher, "watcher");
          expect(watcherImage).toBe(overrides.customImage);
        }

        const zarfYaml = await resource.oneFromFile(`${overrides.outputDir}/zarf.yaml`);
        {
          const componentImage = zarfYaml.components.at(0).images.at(0);
          expect(componentImage).toBe(overrides.customImage);
        }

        const valuesYaml = await resource.oneFromFile(
          `${overrides.outputDir}/${uuid}-chart/values.yaml`,
        );
        {
          const admissionImage = valuesYaml.admission.image;
          expect(admissionImage).toBe(overrides.customImage);

          const watcherImage = valuesYaml.watcher.image;
          expect(watcherImage).toBe(overrides.customImage);
        }
      });

      it("--timeout, works", async () => {
        const moduleYaml = await resource.manyFromFile(
          `${overrides.outputDir}/pepr-module-${uuid}.yaml`,
        );
        {
          const mwc = resource.select(
            moduleYaml,
            kind.MutatingWebhookConfiguration,
            `pepr-${uuid}`,
          );
          const webhook = mwc.webhooks!.filter(f => f.name === `pepr-${uuid}.pepr.dev`).at(0)!;
          expect(webhook.timeoutSeconds).toBe(overrides.timeout);
        }
        {
          const mwc = resource.select(
            moduleYaml,
            kind.ValidatingWebhookConfiguration,
            `pepr-${uuid}`,
          );
          const webhook = mwc.webhooks!.filter(f => f.name === `pepr-${uuid}.pepr.dev`).at(0)!;
          expect(webhook.timeoutSeconds).toBe(overrides.timeout);
        }

        const valuesYaml = await resource.oneFromFile(
          `${overrides.outputDir}/${uuid}-chart/values.yaml`,
        );
        expect(valuesYaml.admission.webhookTimeout).toBe(overrides.timeout);
      });
    });
  });
});
