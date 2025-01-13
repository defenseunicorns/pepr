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

      it.only("--no-embed, works", async () => {
        // overwrites --custom-image..?

        // deployable module files
        {
          const files = [
            `${moduleDst}/dist/pepr-${uuid}.js`,
            `${moduleDst}/dist/pepr-${uuid}.js.map`,
            `${moduleDst}/dist/pepr-${uuid}.js.LEGAL.txt`,
            `${moduleDst}/dist/pepr-module-${uuid}.yaml`,
          ];
          for (const file of files) {
            await expect(fs.access(file)).rejects.toThrowError("no such file or directory");
          }
        }

        // zarf manifest
        {
          const file = `${moduleDst}/dist/zarf.yaml`;
          await expect(fs.access(file)).rejects.toThrowError("no such file or directory");
        }

        // helm chart
        {
          const file = `${moduleDst}/dist/${uuid}-chart/`;
          await expect(fs.access(file)).rejects.toThrowError("no such file or directory");
        }

        // importable module files
        {
          const files = [
            `${moduleDst}/dist/pepr.js`,
            `${moduleDst}/dist/pepr.js.map`,
            `${moduleDst}/dist/pepr.js.LEGAL.txt`,
          ];
          for (const file of files) {
            await expect(fs.access(file)).resolves.toBe(undefined);
          }
        }
      });
    });

    describe("that uses a custom registry", () => {
      it(
        "--registry-info, works",
        async () => {
          // overwrites --custom-image..?

          const moduleDst = `${workdir.path()}/reginfo`;
          await pepr.copyModule(moduleSrc, moduleDst);
          await pepr.cli(moduleDst, { cmd: `npm install` });

          const registryInfo = "registry.io/username";
          const argz = [`--registry-info ${registryInfo}`].join(" ");
          const build = await pepr.cli(moduleDst, { cmd: `pepr build ${argz}` });
          expect(build.exitcode).toBe(0);
          expect(build.stderr.join("").trim()).toBe("");
          expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

          const packageJson = await resource.oneFromFile(`${moduleDst}/package.json`);
          const uuid = packageJson.pepr.uuid;
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
        },
        time.toMs("2m"),
      );
    });

    describe("using build override options", () => {
      let moduleDst: string;
      let packageJson;
      let uuid: string;
      const overrides = {
        entryPoint: "pepr2.ts",
        customImage: "pepr:override",
      };

      beforeAll(async () => {
        moduleDst = `${workdir.path()}/overrides`;

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

      it("--custom-image, works", async () => {
        const moduleYaml = await resource.manyFromFile(
          `${moduleDst}/dist/pepr-module-${uuid}.yaml`,
        );
        {
          const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
          const admissionImage = getDepConImg(admission, "server");
          expect(admissionImage).toBe(overrides.customImage);

          const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
          const watcherImage = getDepConImg(watcher, "watcher");
          expect(watcherImage).toBe(overrides.customImage);
        }

        const zarfYaml = await resource.oneFromFile(`${moduleDst}/dist/zarf.yaml`);
        {
          const componentImage = zarfYaml.components.at(0).images.at(0);
          expect(componentImage).toBe(overrides.customImage);
        }

        const valuesYaml = await resource.oneFromFile(
          `${moduleDst}/dist/${uuid}-chart/values.yaml`,
        );
        {
          const admissionImage = valuesYaml.admission.image;
          expect(admissionImage).toBe(overrides.customImage);

          const watcherImage = valuesYaml.watcher.image;
          expect(watcherImage).toBe(overrides.customImage);
        }
      });
    });
  });
});
