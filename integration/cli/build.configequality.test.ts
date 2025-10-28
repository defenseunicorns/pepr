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

      const getPeprResources = (): KubernetesObject[] => peprResources;
      const getHelmResources = (): KubernetesObject[] => helmResources;

      it("peprVersion", async () => {
        const peprStringified = JSON.stringify(getPeprResources());
        const helmStringified = JSON.stringify(getHelmResources());
        expect(peprStringified.includes(moduleConfig.peprVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.peprVersion)).toBe(false);
      });

      it("appVersion", async () => {
        const peprStringified = JSON.stringify(getPeprResources());
        const helmStringified = JSON.stringify(getHelmResources());
        expect(peprStringified.includes(moduleConfig.appVersion)).toBe(false);
        expect(helmStringified.includes(moduleConfig.appVersion)).toBe(false);
      });

      describe("uuid", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        const resourceKinds = [
          { kind: kind.ClusterRole, name: (uuid: string): string => uuid },
          { kind: kind.ServiceAccount, name: (uuid: string): string => uuid },
          { kind: kind.Secret, name: (uuid: string): string => `${uuid}-api-path` },
          { kind: kind.Secret, name: (uuid: string): string => `${uuid}-tls` },
          { kind: kind.Secret, name: (uuid: string): string => `${uuid}-module` },
          { kind: kind.Service, name: (uuid: string): string => uuid },
          { kind: kind.Service, name: (uuid: string): string => `${uuid}-watcher` },
          { kind: kind.Role, name: (uuid: string): string => `${uuid}-store` },
          { kind: kind.Deployment, name: (uuid: string): string => uuid },
          { kind: kind.Deployment, name: (uuid: string): string => `${uuid}-watcher` },
          { kind: kind.MutatingWebhookConfiguration, name: (uuid: string): string => uuid },
          { kind: kind.ValidatingWebhookConfiguration, name: (uuid: string): string => uuid },
        ];

        it.each(
          sources.flatMap(src =>
            resourceKinds.map(resourceKind => ({
              source: src.source,
              getResources: src.getResources,
              resourceKind: resourceKind.kind,
              name: resourceKind.name,
            })),
          ),
        )(
          "$resourceKind in $source resources should be defined",
          ({ getResources, resourceKind, name }) => {
            const res = resource.select(getResources(), resourceKind, name(peprUuid));
            expect(res).toBeDefined();
          },
        );

        it.each(sources)(
          "ClusterRoleBinding in $source resources should have correct roleRef and subjects",
          ({ getResources }) => {
            const crb = resource.select(getResources(), kind.ClusterRoleBinding, peprUuid);
            expect(crb).toBeDefined();
            expect(crb.roleRef.name).toBe(peprUuid);
            expect(crb.subjects?.[0]?.name).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "RoleBinding in $source resources should have correct roleRef and subjects",
          ({ getResources }) => {
            const rb = resource.select(getResources(), kind.RoleBinding, `${peprUuid}-store`);
            expect(rb).toBeDefined();
            expect(rb.roleRef.name).toBe(`${peprUuid}-store`);
            expect(rb.subjects?.[0]?.name).toBe(`${peprUuid}-store`);
          },
        );

        it.each(sources)(
          "Deployment (admission) in $source resources should have correct labels and volumes",
          ({ getResources }) => {
            const deployment = resource.select(getResources(), kind.Deployment, peprUuid);
            expect(deployment).toBeDefined();
            expect(deployment.metadata?.labels?.app).toBe(peprUuid);
            expect(deployment.metadata?.labels?.["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
            expect(deployment.spec?.template?.spec?.serviceAccountName).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "Deployment (watcher) in $source resources should have correct labels and volumes",
          ({ getResources }) => {
            const deployment = resource.select(
              getResources(),
              kind.Deployment,
              `${peprUuid}-watcher`,
            );
            expect(deployment).toBeDefined();
            expect(deployment.metadata?.labels?.app).toBe(`${peprUuid}-watcher`);
            expect(deployment.metadata?.labels?.["pepr.dev/uuid"]).toBe(moduleConfig.uuid);
            expect(deployment.spec?.template?.spec?.serviceAccountName).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "Service (admission) in $source resources should have correct selector",
          ({ getResources }) => {
            const svc = resource.select(getResources(), kind.Service, peprUuid);
            expect(svc).toBeDefined();
            expect(svc.spec?.selector?.app).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "Service (watcher) in $source resources should have correct selector",
          ({ getResources }) => {
            const svc = resource.select(getResources(), kind.Service, `${peprUuid}-watcher`);
            expect(svc).toBeDefined();
            expect(svc.spec?.selector?.app).toBe(`${peprUuid}-watcher`);
          },
        );

        it.each(sources)(
          "MutatingWebhookConfiguration in $source resources should have correct webhook config",
          ({ getResources }) => {
            const mwc = resource.select(
              getResources(),
              kind.MutatingWebhookConfiguration,
              peprUuid,
            );
            expect(mwc).toBeDefined();
            expect(mwc.webhooks?.[0]?.name).toBe(`${peprUuid}.pepr.dev`);
            expect(mwc.webhooks?.[0]?.clientConfig?.service?.name).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "ValidatingWebhookConfiguration in $source resources should have correct webhook config",
          ({ getResources }) => {
            const vwc = resource.select(
              getResources(),
              kind.ValidatingWebhookConfiguration,
              peprUuid,
            );
            expect(vwc).toBeDefined();
            expect(vwc.webhooks?.[0]?.name).toBe(`${peprUuid}.pepr.dev`);
            expect(vwc.webhooks?.[0]?.clientConfig?.service?.name).toBe(peprUuid);
          },
        );

        it.each(sources)(
          "Store ServiceAccount in $source resources should have correct name",
          ({ getResources }) => {
            const sa = resource.select(getResources(), kind.ServiceAccount, peprUuid);
            expect(sa).toBeDefined();
            expect(sa.metadata?.name).toBe(peprUuid);
          },
        );
      });

      describe("webhookTimeout", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(sources)(
          "MutatingWebhookConfiguration in $source resources should have correct timeout",
          ({ getResources }) => {
            const mwc = resource.select(
              getResources(),
              kind.MutatingWebhookConfiguration,
              peprUuid,
            );
            expect(mwc.webhooks?.[0]?.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
          },
        );

        it.each(sources)(
          "ValidatingWebhookConfiguration in $source resources should have correct timeout",
          ({ getResources }) => {
            const vwc = resource.select(
              getResources(),
              kind.ValidatingWebhookConfiguration,
              peprUuid,
            );
            expect(vwc.webhooks?.[0]?.timeoutSeconds).toBe(moduleConfig.webhookTimeout);
          },
        );
      });

      describe("onError", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(sources)(
          "MutatingWebhookConfiguration in $source resources should have correct failure policy",
          ({ getResources }) => {
            const policy = moduleConfig.onError === "reject" ? "Fail" : "Ignore";
            const mwc = resource.select(
              getResources(),
              kind.MutatingWebhookConfiguration,
              peprUuid,
            );
            expect(mwc.webhooks?.[0]?.failurePolicy).toBe(policy);
          },
        );

        it.each(sources)(
          "ValidatingWebhookConfiguration in $source resources should have correct failure policy",
          ({ getResources }) => {
            const policy = moduleConfig.onError === "reject" ? "Fail" : "Ignore";
            const vwc = resource.select(
              getResources(),
              kind.ValidatingWebhookConfiguration,
              peprUuid,
            );
            expect(vwc.webhooks?.[0]?.failurePolicy).toBe(policy);
          },
        );
      });

      describe("alwaysIgnore.namespaces", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(sources)(
          "MutatingWebhookConfiguration in $source resources should contain ignored namespaces",
          ({ getResources }) => {
            const mwc = resource.select(
              getResources(),
              kind.MutatingWebhookConfiguration,
              peprUuid,
            );
            expect(mwc.webhooks?.[0]?.namespaceSelector?.matchExpressions?.[0]?.values).toEqual(
              expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
            );
          },
        );

        it.each(sources)(
          "ValidatingWebhookConfiguration in $source resources should contain ignored namespaces",
          ({ getResources }) => {
            const vwc = resource.select(
              getResources(),
              kind.ValidatingWebhookConfiguration,
              peprUuid,
            );
            expect(vwc.webhooks?.[0]?.namespaceSelector?.matchExpressions?.[0]?.values).toEqual(
              expect.arrayContaining(moduleConfig.alwaysIgnore.namespaces!),
            );
          },
        );
      });

      describe("logLevel", () => {
        const deployments = [peprUuid, peprUuid];
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(deployments.flatMap(deployment => sources.map(s => ({ ...s, deployment }))))(
          "$deployment in $source resources should have LOG_LEVEL env var",
          ({ getResources }) => {
            const deployment = resource.select(getResources(), kind.Deployment, peprUuid);
            expect(deployment.spec?.template?.spec?.containers?.[0]?.env).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  name: "LOG_LEVEL",
                  value: moduleConfig.logLevel,
                }),
              ]),
            );
          },
        );
      });

      describe("env", () => {
        const deployments = [peprUuid, `${peprUuid}-watcher`];
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(deployments.flatMap(deployment => sources.map(s => ({ ...s, deployment }))))(
          "$deployment in $source resources should have TEST env var",
          ({ getResources }) => {
            const deployment = resource.select(
              getResources(),
              kind.Deployment,
              `${peprUuid}-watcher`,
            );
            expect(deployment.spec?.template?.spec?.containers?.[0]?.env).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  name: "TEST",
                  value: moduleConfig.env.TEST,
                }),
              ]),
            );
          },
        );
      });

      describe("customLabels.namespace", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(sources)(
          "Namespace in $source resources should contain custom labels",
          ({ getResources }) => {
            const ns = resource.select(getResources(), kind.Namespace, "pepr-system");
            expect(ns.metadata?.labels).toEqual(
              expect.objectContaining(moduleConfig.customLabels.namespace!),
            );
          },
        );

        it("Namespace in helm resources should contain additional test labels", () => {
          const ns = resource.select(getHelmResources(), kind.Namespace, "pepr-system");
          expect(ns.metadata?.labels).toEqual(
            expect.objectContaining({ test: "test", value: "value" }),
          );
        });
      });

      describe("rbacMode: scoped + rbac: [...]", () => {
        const sources = [
          { source: "pepr", getResources: getPeprResources },
          { source: "helm", getResources: getHelmResources },
        ];

        it.each(sources)(
          "ClusterRole in $source resources should contain all policy rules",
          ({ getResources }) => {
            const cr = resource.select(getResources(), kind.ClusterRole, peprUuid);
            moduleConfig.rbac.forEach(rule => expect(cr.rules).toContainEqual(rule));
          },
        );
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

  const build = await pepr.cli(testModule, { cmd: `pepr build` });
  expect(build.exitcode).toBe(0);
  expect(build.stderr.join("").trim()).toBe("");
  expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

  const chartDir = `${testModule}/dist/${moduleConfig.uuid}-chart`;
  const helm = await pepr.cli(chartDir, { cmd: `helm template .` });
  expect(helm.exitcode).toBe(0);
  expect(helm.stderr.join("").trim()).toBe("");
  expect(helm.stdout.join("").trim()).not.toBe("");

  const helmManifest = `${chartDir}/reified.yaml`;
  await fs.writeFile(helmManifest, helm.stdout.join("\n"));
  const helmResources = await resource.fromFile(helmManifest);

  const peprManifest = `${testModule}/dist/pepr-module-${moduleConfig.uuid}.yaml`;
  const peprResources = await resource.fromFile(peprManifest);

  return {
    moduleConfig: moduleConfig as Required<ModuleConfig>,
    peprResources,
    helmResources,
    peprUuid,
  };
}
