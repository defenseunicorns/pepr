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
import type { KubernetesObject } from "@kubernetes/client-node";

const FILE = path.basename(__filename);
const HERE = __dirname;

interface PeprPackageJson {
  name: string;
  version: string;
  description: string;
  pepr: ModuleConfig;
}

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("1m"));

  describe("builds a module", () => {
    const id = FILE.split(".").at(1) ?? "default";
    const testModule = `${workdir.path()}/${id}`;
    const packageJson = `${testModule}/package.json`;

    beforeAll(async () => {
      await setupTestModule(testModule, id, workdir.path());
    }, time.toMs("2m"));

    describe("maps config options from package.json into pepr + helm manifests", () => {
      let moduleConfig: Required<ModuleConfig>;
      let peprResources: KubernetesObject[];
      let helmResources: KubernetesObject[];
      let peprUuid: string;

      beforeAll(async () => {
        ({ moduleConfig, peprResources, helmResources, peprUuid } = await buildAndLoadResources(
          packageJson,
          testModule,
        ));
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

      describe("uuid", () => {
        // Test simple resource existence
        it.each([
          { resourceKind: kind.ClusterRole, name: peprUuid },
          { resourceKind: kind.ServiceAccount, name: peprUuid },
          { resourceKind: kind.Secret, name: `${peprUuid}-api-path` },
          { resourceKind: kind.Secret, name: `${peprUuid}-tls` },
          { resourceKind: kind.Secret, name: `${peprUuid}-module` },
          { resourceKind: kind.Service, name: peprUuid },
          { resourceKind: kind.Service, name: `${peprUuid}-watcher` },
          { resourceKind: kind.Role, name: `${peprUuid}-store` },
          { resourceKind: kind.Deployment, name: peprUuid },
          { resourceKind: kind.Deployment, name: `${peprUuid}-watcher` },
          { resourceKind: kind.MutatingWebhookConfiguration, name: peprUuid },
          { resourceKind: kind.ValidatingWebhookConfiguration, name: peprUuid },
        ])(
          "should have $resourceKind.$name in both pepr and helm resources",
          ({ resourceKind, name }) => {
            const peprResource = resource.select(peprResources, resourceKind, name);
            const helmResource = resource.select(helmResources, resourceKind, name);

            expect(peprResource).toBeDefined();
            expect(helmResource).toBeDefined();
          },
        );

        // Test ClusterRoleBinding specific properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "ClusterRoleBinding in $source resources should have correct roleRef and subjects",
          ({ resources }) => {
            const clusterRoleBinding = resource.select(
              resources,
              kind.ClusterRoleBinding,
              peprUuid,
            );

            expect(clusterRoleBinding).toBeDefined();
            expect(clusterRoleBinding.roleRef.name).toBe(peprUuid);
            expect(clusterRoleBinding!.subjects!.at(0)!.name).toBe(peprUuid);
          },
        );

        // Test RoleBinding specific properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "RoleBinding in $source resources should have correct roleRef and subjects",
          ({ resources }) => {
            const roleBindingStore = resource.select(
              resources,
              kind.RoleBinding,
              `${peprUuid}-store`,
            );

            expect(roleBindingStore).toBeDefined();
            expect(roleBindingStore.roleRef.name).toBe(`${peprUuid}-store`);
            expect(roleBindingStore!.subjects!.at(0)!.name).toBe(`${peprUuid}-store`);
          },
        );

        // Test Deployment admission properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "Deployment (admission) in $source resources should have correct labels and volumes",
          ({ resources }) => {
            const deployAdmission = resource.select(resources, kind.Deployment, peprUuid);

            expect(deployAdmission).toBeDefined();
            expect(deployAdmission.metadata!.labels!.app).toBe(peprUuid);
            expect(deployAdmission.metadata!.labels!["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
            expect(deployAdmission.spec!.selector!.matchLabels!.app).toBe(peprUuid);
            expect(deployAdmission.spec!.template!.metadata!.labels!.app).toBe(peprUuid);
            expect(deployAdmission.spec!.template!.spec!.serviceAccountName).toBe(peprUuid);
            expect(
              deployAdmission.spec!.template!.spec!.volumes!.find(vol => vol.name === "tls-certs")!
                .secret!.secretName,
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
          },
        );

        // Test Deployment watcher properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "Deployment (watcher) in $source resources should have correct labels and volumes",
          ({ resources }) => {
            const deployWatcher = resource.select(
              resources,
              kind.Deployment,
              `${peprUuid}-watcher`,
            );

            expect(deployWatcher).toBeDefined();
            expect(deployWatcher.metadata!.labels!.app).toBe(`${peprUuid}-watcher`);
            expect(deployWatcher.metadata!.labels!["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
            expect(deployWatcher.spec!.selector!.matchLabels!.app).toBe(`${peprUuid}-watcher`);
            expect(deployWatcher.spec!.template!.metadata!.labels!.app).toBe(`${peprUuid}-watcher`);
            expect(deployWatcher.spec!.template!.spec!.serviceAccountName).toBe(peprUuid);
            expect(
              deployWatcher.spec!.template!.spec!.volumes!.find(vol => vol.name === "tls-certs")!
                .secret!.secretName,
            ).toBe(`${peprUuid}-tls`);
            expect(
              deployWatcher
                .spec!.template!.spec!.volumes!.filter(vol => vol.name === "module")
                .at(0)!.secret!.secretName,
            ).toBe(`${peprUuid}-module`);
          },
        );

        // Test Service admission properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "Service (admission) in $source resources should have correct selector",
          ({ resources }) => {
            const serviceAdmission = resource.select(resources, kind.Service, peprUuid);

            expect(serviceAdmission).toBeDefined();
            expect(serviceAdmission.spec!.selector!.app).toBe(peprUuid);
          },
        );

        // Test Service watcher properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "Service (watcher) in $source resources should have correct selector",
          ({ resources }) => {
            const serviceWatcher = resource.select(resources, kind.Service, `${peprUuid}-watcher`);

            expect(serviceWatcher).toBeDefined();
            expect(serviceWatcher.spec!.selector!.app).toBe(`${peprUuid}-watcher`);
          },
        );

        // Test MutatingWebhookConfiguration properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "MutatingWebhookConfiguration in $source resources should have correct webhook config",
          ({ resources }) => {
            const mwc = resource.select(resources, kind.MutatingWebhookConfiguration, peprUuid);

            expect(mwc).toBeDefined();
            expect(mwc.webhooks!.at(0)!.name).toBe(`${peprUuid}.pepr.dev`);
            expect(mwc.webhooks!.at(0)!.clientConfig.service!.name).toBe(peprUuid);
          },
        );

        // Test ValidatingWebhookConfiguration properties
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "ValidatingWebhookConfiguration in $source resources should have correct webhook config",
          ({ resources }) => {
            const vwc = resource.select(resources, kind.ValidatingWebhookConfiguration, peprUuid);

            expect(vwc).toBeDefined();
            expect(vwc.webhooks!.at(0)!.name).toBe(`${peprUuid}.pepr.dev`);
            expect(vwc.webhooks!.at(0)!.clientConfig.service!.name).toBe(peprUuid);
          },
        );

        // Test Store resources
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "Store ServiceAccount in $source resources should have correct name",
          ({ resources }) => {
            const serviceAccountStore = resource.select(
              resources,
              kind.ServiceAccount,
              `${peprUuid}-store`,
            );

            expect(serviceAccountStore).toBeDefined();
            expect(serviceAccountStore.metadata!.name).toBe(`${peprUuid}-store`);
          },
        );
      });

      describe("webhookTimeout", () => {
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "MutatingWebhookConfiguration in $source resources should have correct timeout",
          ({ resources }) => {
            const mwc = resource.select(resources, kind.MutatingWebhookConfiguration, peprUuid);
            expect(mwc.webhooks!.at(0)!.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
          },
        );

        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "ValidatingWebhookConfiguration in $source resources should have correct timeout",
          ({ resources }) => {
            const vwc = resource.select(resources, kind.ValidatingWebhookConfiguration, peprUuid);
            expect(vwc.webhooks!.at(0)!.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
          },
        );
      });

      describe("onError", () => {
        const policy = moduleConfig.onError === "reject" ? "Fail" : "Ignore";

        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "MutatingWebhookConfiguration in $source resources should have correct failure policy",
          ({ resources }) => {
            const mwc = resource.select(resources, kind.MutatingWebhookConfiguration, peprUuid);
            expect(mwc.webhooks!.at(0)!.failurePolicy).toBe(policy);
          },
        );

        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "ValidatingWebhookConfiguration in $source resources should have correct failure policy",
          ({ resources }) => {
            const vwc = resource.select(resources, kind.ValidatingWebhookConfiguration, peprUuid);
            expect(vwc.webhooks!.at(0)!.failurePolicy).toBe(policy);
          },
        );
      });

      describe("alwaysIgnore.namespaces", () => {
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "MutatingWebhookConfiguration in $source resources should contain ignored namespaces",
          ({ resources }) => {
            const mwc = resource.select(resources, kind.MutatingWebhookConfiguration, peprUuid);
            expect(mwc.webhooks!.at(0)!.namespaceSelector!.matchExpressions!.at(0)!.values).toEqual(
              expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
            );
          },
        );

        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])(
          "ValidatingWebhookConfiguration in $source resources should contain ignored namespaces",
          ({ resources }) => {
            const vwc = resource.select(resources, kind.ValidatingWebhookConfiguration, peprUuid);
            expect(vwc.webhooks!.at(0)!.namespaceSelector!.matchExpressions!.at(0)!.values).toEqual(
              expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
            );
          },
        );
      });

      describe("logLevel", () => {
        it.each([
          { source: "pepr", resources: peprResources, deploymentName: peprUuid },
          { source: "helm", resources: helmResources, deploymentName: peprUuid },
          { source: "pepr", resources: peprResources, deploymentName: `${peprUuid}-watcher` },
          { source: "helm", resources: helmResources, deploymentName: `${peprUuid}-watcher` },
        ])(
          "$deploymentName in $source resources should have LOG_LEVEL env var",
          ({ resources, deploymentName }) => {
            const deployment = resource.select(resources, kind.Deployment, deploymentName);
            expect(deployment.spec!.template.spec!.containers.at(0)!.env).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ name: "LOG_LEVEL", value: moduleConfig.logLevel }),
              ]),
            );
          },
        );
      });

      describe("env", () => {
        it.each([
          { source: "pepr", resources: peprResources, deploymentName: peprUuid },
          { source: "helm", resources: helmResources, deploymentName: peprUuid },
          { source: "pepr", resources: peprResources, deploymentName: `${peprUuid}-watcher` },
          { source: "helm", resources: helmResources, deploymentName: `${peprUuid}-watcher` },
        ])(
          "$deploymentName in $source resources should have TEST env var",
          ({ resources, deploymentName }) => {
            const deployment = resource.select(resources, kind.Deployment, deploymentName);
            expect(deployment.spec!.template.spec!.containers.at(0)!.env).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ name: "TEST", value: moduleConfig.env.TEST }),
              ]),
            );
          },
        );
      });

      describe("customLabels.namespace", () => {
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])("Namespace in $source resources should contain custom labels", ({ resources }) => {
          const namespace = resource.select(resources, kind.Namespace, "pepr-system");
          expect(namespace.metadata!.labels!).toEqual(
            expect.objectContaining(moduleConfig.customLabels.namespace!),
          );
        });

        it("Namespace in helm resources should contain additional test labels", () => {
          const namespace = resource.select(helmResources, kind.Namespace, "pepr-system");
          expect(namespace.metadata!.labels!).toEqual(
            expect.objectContaining({
              test: "test",
              value: "value",
            }),
          );
        });
      });

      describe("rbacMode: scoped + rbac: [...]", () => {
        it.each([
          { source: "pepr", resources: peprResources },
          { source: "helm", resources: helmResources },
        ])("ClusterRole in $source resources should contain all policy rules", ({ resources }) => {
          const clusterRole = resource.select(resources, kind.ClusterRole, peprUuid);
          moduleConfig.rbac.forEach(policyRule => {
            expect(clusterRole.rules).toContainEqual(policyRule);
          });
        });
      });
    });
  });
});

async function setupTestModule(testModule: string, id: string, workdirPath: string): Promise<void> {
  await fs.rm(testModule, { recursive: true, force: true });

  const args = [
    `--name ${id}`,
    `--description ${id}`,
    `--error-behavior reject`,
    `--uuid random-identifier`,
    "--yes",
    "--skip-post-init",
  ].join(" ");

  await pepr.cli(workdirPath, { cmd: `pepr init ${args}` });
  await pepr.tgzifyModule(testModule);
  await pepr.cli(testModule, { cmd: `npm install` });
}

async function preparePeprConfig(packageJson: string): Promise<PeprPackageJson> {
  const config = (await resource.fromFile(packageJson)) as PeprPackageJson;
  config.description = "testdesc";
  config.pepr = {
    ...config.pepr,
    peprVersion: "1.2.3",
    webhookTimeout: 11,
    onError: "reject",
    alwaysIgnore: { namespaces: ["garbage"] },
    logLevel: "warning",
    env: { TEST: "env" },
    customLabels: {
      namespace: { test: "test", value: "value" },
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
  return config;
}

async function buildAndLoadResources(
  packageJson: string,
  testModule: string,
): Promise<{
  moduleConfig: Required<ModuleConfig>;
  peprResources: KubernetesObject[];
  helmResources: KubernetesObject[];
  peprUuid: string;
}> {
  const config = await preparePeprConfig(packageJson);

  const peprUuid = `pepr-${config.pepr.uuid}`;
  const moduleConfig = {
    ...config.pepr,
    appVersion: config.version,
    description: config.description,
  };

  // Build module
  const build = await pepr.cli(testModule, { cmd: `pepr build` });
  expect(build.exitcode).toBe(0);
  expect(build.stderr.join("").trim()).toBe("");
  expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

  // Load Helm manifests
  const chartDir = `${testModule}/dist/${moduleConfig.uuid}-chart`;
  const helm = await pepr.cli(chartDir, { cmd: `helm template .` });
  expect(helm.exitcode).toBe(0);
  expect(helm.stderr.join("").trim()).toBe("");
  expect(helm.stdout.join("").trim()).not.toBe("");

  const helmManifest = `${chartDir}/reified.yaml`;
  await fs.writeFile(helmManifest, helm.stdout.join("\n"));
  const helmResources = await resource.fromFile(helmManifest);

  // Load Pepr manifests
  const peprManifest = `${testModule}/dist/pepr-module-${moduleConfig.uuid}.yaml`;
  const peprResources = await resource.fromFile(peprManifest);

  return {
    moduleConfig: moduleConfig as Required<ModuleConfig>,
    peprResources,
    helmResources,
    peprUuid,
  };
}
