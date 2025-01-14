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

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  });

  describe("builds a module", () => {
    const id = FILE.split(".").at(1);
    const mod = `${workdir.path()}/${id}`;

    let packageJson;
    let uuid: string;

    beforeAll(async () => {
      await fs.rm(mod, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(mod);
      await pepr.cli(mod, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("using a custom registry", () => {
      const registryInfo = "registry.io/username";

      const getDepConImg = (deploy: kind.Deployment, container: string): string => {
        return deploy!.spec!.template!.spec!.containers.filter(f => f.name === container).at(0)!
          .image!;
      };

      it(
        "builds",
        async () => {
          const argz = [`--registry-info ${registryInfo}`].join(" ");
          const build = await pepr.cli(mod, { cmd: `pepr build ${argz}` });
          expect(build.exitcode).toBe(0);
          expect(build.stderr.join("").trim()).toBe("");
          expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

          packageJson = await resource.oneFromFile(`${mod}/package.json`);
          uuid = packageJson.pepr.uuid;
        },
        time.toMs("1m"),
      );

      it("outputs appropriate configuration", async () => {
        // overwrites --custom-image..?
        const image = `${registryInfo}/custom-pepr-controller:0.0.0-development`;

        {
          const moduleYaml = await resource.manyFromFile(`${mod}/dist/pepr-module-${uuid}.yaml`);
          const admission = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}`);
          const admissionImage = getDepConImg(admission, "server");
          expect(admissionImage).toBe(image);

          const watcher = resource.select(moduleYaml, kind.Deployment, `pepr-${uuid}-watcher`);
          const watcherImage = getDepConImg(watcher, "watcher");
          expect(watcherImage).toBe(image);
        }
        {
          const zarfYaml = await resource.oneFromFile(`${mod}/dist/zarf.yaml`);
          const componentImage = zarfYaml.components.at(0).images.at(0);
          expect(componentImage).toBe(image);
        }
        {
          const valuesYaml = await resource.oneFromFile(`${mod}/dist/${uuid}-chart/values.yaml`);
          const admissionImage = valuesYaml.admission.image;
          expect(admissionImage).toBe(image);

          const watcherImage = valuesYaml.watcher.image;
          expect(watcherImage).toBe(image);
        }
      });
    });
  });
});
