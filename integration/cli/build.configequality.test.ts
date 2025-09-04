// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { kind } from "kubernetes-fluent-client";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import { ModuleConfig } from "../../src/lib/types";

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
        `--error-behavior reject`,
        `--uuid random-identifier`,
        "--yes",
        "--skip-post-init",
      ].join(" ");

      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("maps config options from package.json into pepr + helm manifests", () => {
      let moduleConfig: Required<ModuleConfig>;
      let peprResources: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let helmResources: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let peprUuid: string;

      // eslint-disable-next-line max-statements
      beforeAll(async () => {
        // set configuration in package.json
        const config = await resource.fromFile(packageJson);
        config.description = "testdesc";
        config.pepr = {
          ...config.pepr,
          peprVersion: "1.2.3",
          webhookTimeout: 11,
          onError: "reject",
          alwaysIgnore: {
            namespaces: ["garbage"],
          },
          logLevel: "warning",
          env: {
            TEST: "env",
          },
          customLabels: {
            namespace: {
              test: "test",
              value: "value",
            },
          },
          rbacMode: "scoped",
          rbac: [
            {
              apiGroups: ["test"],
              resources: ["tests"],
              verbs: ["get", "list"],
            },
          ],
        };
        await fs.writeFile(packageJson, JSON.stringify(config, null, 2));

        // translate package.json values into ModuleConfig
        peprUuid = `pepr-${config.pepr.uuid}`;
        moduleConfig = config.pepr;
        moduleConfig.appVersion = config.version;
        moduleConfig.description = config.description;

        // build module
        const build = await pepr.cli(testModule, { cmd: `pepr build` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        // load helm manifests
        const chartDir = `${testModule}/dist/${moduleConfig.uuid}-chart`;
        const helm = await pepr.cli(chartDir, { cmd: `helm template .` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).not.toBe("");

        const helmManifest = `${chartDir}/reified.yaml`;
        await fs.writeFile(helmManifest, helm.stdout.join("\n"));
        helmResources = await resource.fromFile(helmManifest);

        // load pepr manifests
        const peprManifest = `${testModule}/dist/pepr-module-${moduleConfig.uuid}.yaml`;
        peprResources = await resource.fromFile(peprManifest);
      }, time.toMs("2m"));

      it("peprVersion", async () => {
        const peprStringified = JSON.stringify(peprResources);
        const helmStringified = JSON.stringify(helmResources);

        expect(peprStringified.includes(moduleConfig.peprVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.peprVersion)).toBe(false);
      });

      it("appVersion", async () => {
        const peprStringified = JSON.stringify(peprResources);
        const helmStringified = JSON.stringify(helmResources);

        expect(peprStringified.includes(moduleConfig.appVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.appVersion)).toBe(false);
      });

      it("uuid", async () => {
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

        for (const secretApiPath of [
          resource.select(peprResources, kind.Secret, `${peprUuid}-api-path`),
          resource.select(helmResources, kind.Secret, `${peprUuid}-api-path`),
        ]) {
          expect(secretApiPath).toBeDefined();
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
              .spec!.template!.spec!.volumes!.filter(vol => vol.name === "api-path")
              .at(0)!.secret!.secretName,
          ).toBe(`${peprUuid}-api-path`);
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
      });

      it("description", async () => {
        for (const deployAdmission of [
          resource.select(peprResources, kind.Deployment, peprUuid),
          resource.select(helmResources, kind.Deployment, peprUuid),
        ]) {
          expect(deployAdmission.metadata!.annotations!["pepr.dev/description"]).toBe(
            moduleConfig.description,
          );
        }

        for (const deployWatcher of [
          resource.select(peprResources, kind.Deployment, `${peprUuid}-watcher`),
          resource.select(helmResources, kind.Deployment, `${peprUuid}-watcher`),
        ]) {
          expect(deployWatcher.metadata!.annotations!["pepr.dev/description"]).toBe(
            moduleConfig.description,
          );
        }
      });

      it("webhookTimeout", async () => {
        for (const mwc of [
          resource.select(peprResources, kind.MutatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.MutatingWebhookConfiguration, peprUuid),
        ]) {
          expect(mwc.webhooks!.at(0)!.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
        }

        for (const vwc of [
          resource.select(peprResources, kind.ValidatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.ValidatingWebhookConfiguration, peprUuid),
        ]) {
          expect(vwc.webhooks!.at(0)!.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
        }
      });

      it("onError", async () => {
        const policy = moduleConfig.onError === "reject" ? "Fail" : "Ignore";

        for (const mwc of [
          resource.select(peprResources, kind.MutatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.MutatingWebhookConfiguration, peprUuid),
        ]) {
          expect(mwc.webhooks!.at(0)!.failurePolicy).toBe(policy);
        }

        for (const vwc of [
          resource.select(peprResources, kind.ValidatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.ValidatingWebhookConfiguration, peprUuid),
        ]) {
          expect(vwc.webhooks!.at(0)!.failurePolicy).toBe(policy);
        }
      });

      it("alwaysIgnore.namespaces", async () => {
        for (const mwc of [
          resource.select(peprResources, kind.MutatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.MutatingWebhookConfiguration, peprUuid),
        ]) {
          expect(mwc.webhooks!.at(0)!.namespaceSelector!.matchExpressions!.at(0)!.values).toEqual(
            expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
          );
        }

        for (const vwc of [
          resource.select(peprResources, kind.ValidatingWebhookConfiguration, peprUuid),
          resource.select(helmResources, kind.ValidatingWebhookConfiguration, peprUuid),
        ]) {
          expect(vwc.webhooks!.at(0)!.namespaceSelector!.matchExpressions!.at(0)!.values).toEqual(
            expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
          );
        }
      });

      it("logLevel", async () => {
        for (const deployAdmission of [
          resource.select(peprResources, kind.Deployment, peprUuid),
          resource.select(helmResources, kind.Deployment, peprUuid),
        ]) {
          expect(deployAdmission.spec!.template.spec!.containers.at(0)!.env).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: "LOG_LEVEL", value: moduleConfig.logLevel }),
            ]),
          );
        }

        for (const deployWatcher of [
          resource.select(peprResources, kind.Deployment, `${peprUuid}-watcher`),
          resource.select(helmResources, kind.Deployment, `${peprUuid}-watcher`),
        ]) {
          expect(deployWatcher.spec!.template.spec!.containers.at(0)!.env).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: "LOG_LEVEL", value: moduleConfig.logLevel }),
            ]),
          );
        }
      });

      it("env", async () => {
        for (const deployAdmission of [
          resource.select(peprResources, kind.Deployment, peprUuid),
          resource.select(helmResources, kind.Deployment, peprUuid),
        ]) {
          expect(deployAdmission.spec!.template.spec!.containers.at(0)!.env).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: "TEST", value: moduleConfig.env.TEST }),
            ]),
          );
        }

        for (const deployWatcher of [
          resource.select(peprResources, kind.Deployment, `${peprUuid}-watcher`),
          resource.select(helmResources, kind.Deployment, `${peprUuid}-watcher`),
        ]) {
          expect(deployWatcher.spec!.template.spec!.containers.at(0)!.env).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: "TEST", value: moduleConfig.env.TEST }),
            ]),
          );
        }
      });

      it("customLabels.namespace", async () => {
        for (const namespace of [
          resource.select(peprResources, kind.Namespace, "pepr-system"),
          resource.select(helmResources, kind.Namespace, "pepr-system"),
        ]) {
          expect(namespace.metadata!.labels!).toEqual(
            expect.objectContaining(moduleConfig.customLabels.namespace!),
          );
        }

        for (const namespace of [resource.select(helmResources, kind.Namespace, "pepr-system")]) {
          expect(namespace.metadata!.labels!).toEqual(
            expect.objectContaining({
              test: "test",
              value: "value",
            }),
          );
        }
      });

      it("rbacMode: scoped + rbac: [...]", async () => {
        for (const clusterRole of [
          resource.select(peprResources, kind.ClusterRole, peprUuid),
          resource.select(helmResources, kind.ClusterRole, peprUuid),
        ]) {
          moduleConfig.rbac.forEach(policyRule => {
            expect(clusterRole.rules).toContainEqual(policyRule);
          });
        }
      });
    });
  });
});
