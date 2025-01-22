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
import { ModuleConfig } from "../../src/lib/core/module";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("1m"));

  describe("builds a module", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;
    const packageJson = `${testModule}/package.json`;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("using every config option in package.json > pepr", () => {
      let moduleConfig: Required<ModuleConfig>;
      let peprResources: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let helmResources: any; // eslint-disable-line @typescript-eslint/no-explicit-any

      beforeAll(async () => {
        // set configuration in package.json
        const config = await resource.fromFile(packageJson);
        config.pepr = {
          ...config.pepr,
          peprVersion: "1.2.3",
        };
        await fs.writeFile(packageJson, JSON.stringify(config, null, 2));
        moduleConfig = config.pepr;
        moduleConfig.appVersion = config.version;

        // build module
        const build = await pepr.cli(testModule, { cmd: `pepr build` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        // load helm manifests
        const uuid = moduleConfig.uuid;
        const chartDir = `${testModule}/dist/${uuid}-chart`;
        const helm = await pepr.cli(chartDir, { cmd: `helm template .` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).not.toBe("");

        const helmManifest = `${chartDir}/reified.yaml`;
        await fs.writeFile(helmManifest, helm.stdout.join("\n"));
        helmResources = await resource.fromFile(helmManifest);

        // load pepr manifests
        const peprManifest = `${testModule}/dist/pepr-module-${uuid}.yaml`;
        peprResources = await resource.fromFile(peprManifest);
      }, time.toMs("2m"));

      it("configures both raw manifest and helm chart manifests appropriately", async () => {
        // eslint-disable-line max-statements, complexity
        const peprStringified = JSON.stringify(peprResources);
        const helmStringified = JSON.stringify(helmResources);

        // peprVersion
        expect(peprStringified.includes(moduleConfig.peprVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.peprVersion)).toBe(false);

        // appVersion
        expect(peprStringified.includes(moduleConfig.appVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.appVersion)).toBe(false);

        // uuid
        const peprUuid = `pepr-${moduleConfig.uuid}`;

        for (const clusterRole of [
          resource.select(peprResources, kind.ClusterRole, peprUuid),
          resource.select(helmResources, kind.ClusterRole, peprUuid),
        ]) {
          expect(clusterRole).toBeDefined();
        }

        for (const clusterRoleBinding of [
          resource.select(peprResources, kind.ClusterRoleBinding, peprUuid),
          resource.select(helmResources, kind.ClusterRoleBinding, peprUuid),
        ]) {
          expect(clusterRoleBinding).toBeDefined();
          expect(clusterRoleBinding.roleRef.name).toBe(peprUuid);
          expect(clusterRoleBinding!.subjects!.at(0)!.name).toBe(peprUuid);
        }

        for (const serviceAccount of [
          resource.select(peprResources, kind.ServiceAccount, peprUuid),
          resource.select(helmResources, kind.ServiceAccount, peprUuid),
        ]) {
          expect(serviceAccount).toBeDefined();
        }

        for (const secretApiToken of [
          resource.select(peprResources, kind.Secret, `${peprUuid}-api-token`),
          resource.select(helmResources, kind.Secret, `${peprUuid}-api-token`),
        ]) {
          expect(secretApiToken).toBeDefined();
        }

        for (const secretTls of [
          resource.select(peprResources, kind.Secret, `${peprUuid}-tls`),
          resource.select(helmResources, kind.Secret, `${peprUuid}-tls`),
        ]) {
          expect(secretTls).toBeDefined();
        }

        for (const deployAdmission of [
          resource.select(peprResources, kind.Deployment, peprUuid),
          resource.select(helmResources, kind.Deployment, peprUuid),
        ]) {
          expect(deployAdmission).toBeDefined();
          expect(deployAdmission.metadata!.labels!.app).toBe(peprUuid);
          expect(deployAdmission.metadata!.labels!["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
          expect(deployAdmission.spec!.selector!.matchLabels!.app).toBe(peprUuid);
          expect(deployAdmission.spec!.template!.metadata!.labels!.app).toBe(peprUuid);
          expect(deployAdmission.spec!.template!.spec!.serviceAccountName).toBe(peprUuid);
          expect(
            deployAdmission
              .spec!.template!.spec!.volumes!.filter(vol => vol.name === "tls-certs")
              .at(0)!.secret!.secretName,
          ).toBe(`${peprUuid}-tls`);
          expect(
            deployAdmission
              .spec!.template!.spec!.volumes!.filter(vol => vol.name === "api-token")
              .at(0)!.secret!.secretName,
          ).toBe(`${peprUuid}-api-token`);
          expect(
            deployAdmission
              .spec!.template!.spec!.volumes!.filter(vol => vol.name === "module")
              .at(0)!.secret!.secretName,
          ).toBe(`${peprUuid}-module`);
        }

        for (const serviceAdmission of [
          resource.select(peprResources, kind.Service, peprUuid),
          resource.select(helmResources, kind.Service, peprUuid),
        ]) {
          expect(serviceAdmission).toBeDefined();
          expect(serviceAdmission.spec!.selector!.app).toBe(peprUuid);
        }

        for (const serviceWatcher of [
          resource.select(peprResources, kind.Service, `${peprUuid}-watcher`),
          resource.select(helmResources, kind.Service, `${peprUuid}-watcher`),
        ]) {
          expect(serviceWatcher).toBeDefined();
          expect(serviceWatcher.spec!.selector!.app).toBe(`${peprUuid}-watcher`);
        }

        for (const secretModule of [
          resource.select(peprResources, kind.Secret, `${peprUuid}-module`),
          resource.select(helmResources, kind.Secret, `${peprUuid}-module`),
        ]) {
          expect(secretModule).toBeDefined();
        }

        for (const roleStore of [
          resource.select(peprResources, kind.Role, `${peprUuid}-store`),
          resource.select(helmResources, kind.Role, `${peprUuid}-store`),
        ]) {
          expect(roleStore).toBeDefined();
        }

        for (const roleBindingStore of [
          resource.select(peprResources, kind.RoleBinding, `${peprUuid}-store`),
          resource.select(helmResources, kind.RoleBinding, `${peprUuid}-store`),
        ]) {
          expect(roleBindingStore).toBeDefined();
          expect(roleBindingStore.roleRef.name).toBe(`${peprUuid}-store`);
          expect(roleBindingStore!.subjects!.at(0)!.name).toBe(`${peprUuid}-store`);
        }

        for (const mwc of [
          resource.select(peprResources, kind.MutatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.MutatingWebhookConfiguration, peprUuid),
        ]) {
          expect(mwc).toBeDefined();
          expect(mwc.webhooks!.at(0)!.name).toBe(`${peprUuid}.pepr.dev`);
          expect(mwc.webhooks!.at(0)!.clientConfig.service!.name).toBe(peprUuid);
        }

        for (const vwc of [
          resource.select(peprResources, kind.ValidatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.ValidatingWebhookConfiguration, peprUuid),
        ]) {
          expect(vwc).toBeDefined();
          expect(vwc.webhooks!.at(0)!.name).toBe(`${peprUuid}.pepr.dev`);
          expect(vwc.webhooks!.at(0)!.clientConfig.service!.name).toBe(peprUuid);
        }

        for (const deployWatcher of [
          resource.select(peprResources, kind.Deployment, `${peprUuid}-watcher`),
          resource.select(helmResources, kind.Deployment, `${peprUuid}-watcher`),
        ]) {
          expect(deployWatcher).toBeDefined();
          expect(deployWatcher.metadata!.labels!.app).toBe(`${peprUuid}-watcher`);
          expect(deployWatcher.metadata!.labels!["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
          expect(deployWatcher.spec!.selector!.matchLabels!.app).toBe(`${peprUuid}-watcher`);
          expect(deployWatcher.spec!.template!.metadata!.labels!.app).toBe(`${peprUuid}-watcher`);
          expect(deployWatcher.spec!.template!.spec!.serviceAccountName).toBe(peprUuid);
          expect(
            deployWatcher
              .spec!.template!.spec!.volumes!.filter(vol => vol.name === "tls-certs")
              .at(0)!.secret!.secretName,
          ).toBe(`${peprUuid}-tls`);
          expect(
            deployWatcher.spec!.template!.spec!.volumes!.filter(vol => vol.name === "module").at(0)!
              .secret!.secretName,
          ).toBe(`${peprUuid}-module`);
        }

        // /** Global configuration for the Pepr runtime. */
        // export type ModuleConfig = {

        //   /** A unique identifier for this Pepr module. This is automatically generated by Pepr. */
        //   uuid: string;
        //   /** A description of the Pepr module and what it does. */
        //   description?: string;
        //   /** The webhookTimeout */
        //   webhookTimeout?: number;
        //   /** Reject K8s resource AdmissionRequests on error. */
        //   onError?: string;
        //   /** Configure global exclusions that will never be processed by Pepr. */
        //   alwaysIgnore: WebhookIgnore;
        //   /** Define the log level for the in-cluster controllers */
        //   logLevel?: string;
        //   /** Propagate env variables to in-cluster controllers */
        //   env?: Record<string, string>;
        //   /** Custom Labels for Kubernetes Objects */
        //   customLabels?: CustomLabels;
        //   /** Custom RBAC rules */
        //   rbac?: PolicyRule[];
        //   /** The RBAC mode; if "scoped", generates scoped rules, otherwise uses wildcard rules. */
        //   rbacMode?: string;
        // };
        // TODO: can we (somehow) introspect the type to know which / how many props to match?
        //  - need to be able to have the test suite flag when "a change that needs testing" has happened
      });
    });
  });
});
