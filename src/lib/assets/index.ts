// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { dumpYaml } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { ModuleConfig } from "../module";
import { TLSOut, genTLS } from "../tls";
import { CapabilityExport } from "../types";
import { WebhookIgnore } from "../k8s";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, zarfYaml, overridesFile, zarfYamlChart } from "./yaml";
import { namespaceComplianceValidator, replaceString } from "../helpers";
import { dedent } from "../helpers";
import { resolve } from "path";
import {
  chartYaml,
  nsTemplate,
  admissionDeployTemplate,
  watcherDeployTemplate,
  clusterRoleTemplate,
  serviceMonitorTemplate,
} from "./helm";
import { promises as fs } from "fs";
import { webhookConfig } from "./webhooks";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { watcher, moduleSecret } from "./pods";

import { clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { createDirectoryIfNotExists } from "../filesystemService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toYaml(obj: any): string {
  return dumpYaml(obj, { noRefs: true });
}

function webhookYaml(
  assets: Assets,
  whc: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
): string {
  const yaml = toYaml(whc);
  return replaceString(
    replaceString(
      replaceString(yaml, assets.name, "{{ .Values.uuid }}"),
      assets.config.onError === "reject" ? "Fail" : "Ignore",
      "{{ .Values.admission.failurePolicy }}",
    ),
    `${assets.config.webhookTimeout}` || "10",
    "{{ .Values.admission.webhookTimeout }}",
  );
}

function helmLayout(basePath: string, unique: string) {
  const helm: Record<string, Record<string, string>> = {
    dirs: {
      chart: resolve(`${basePath}/${unique}-chart`),
    },
    files: {},
  };

  helm.dirs = {
    ...helm.dirs,
    charts: `${helm.dirs.chart}/charts`,
    tmpls: `${helm.dirs.chart}/templates`,
  };

  helm.files = {
    ...helm.files,
    valuesYaml: `${helm.dirs.chart}/values.yaml`,
    chartYaml: `${helm.dirs.chart}/Chart.yaml`,
    namespaceYaml: `${helm.dirs.tmpls}/namespace.yaml`,
    watcherServiceYaml: `${helm.dirs.tmpls}/watcher-service.yaml`,
    admissionServiceYaml: `${helm.dirs.tmpls}/admission-service.yaml`,
    mutationWebhookYaml: `${helm.dirs.tmpls}/mutation-webhook.yaml`,
    validationWebhookYaml: `${helm.dirs.tmpls}/validation-webhook.yaml`,
    admissionDeploymentYaml: `${helm.dirs.tmpls}/admission-deployment.yaml`,
    admissionServiceMonitorYaml: `${helm.dirs.tmpls}/admission-service-monitor.yaml`,
    watcherDeploymentYaml: `${helm.dirs.tmpls}/watcher-deployment.yaml`,
    watcherServiceMonitorYaml: `${helm.dirs.tmpls}/watcher-service-monitor.yaml`,
    tlsSecretYaml: `${helm.dirs.tmpls}/tls-secret.yaml`,
    apiTokenSecretYaml: `${helm.dirs.tmpls}/api-token-secret.yaml`,
    moduleSecretYaml: `${helm.dirs.tmpls}/module-secret.yaml`,
    storeRoleYaml: `${helm.dirs.tmpls}/store-role.yaml`,
    storeRoleBindingYaml: `${helm.dirs.tmpls}/store-role-binding.yaml`,
    clusterRoleYaml: `${helm.dirs.tmpls}/cluster-role.yaml`,
    clusterRoleBindingYaml: `${helm.dirs.tmpls}/cluster-role-binding.yaml`,
    serviceAccountYaml: `${helm.dirs.tmpls}/service-account.yaml`,
  };

  return helm;
}

export class Assets {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiToken: string;
  readonly alwaysIgnore!: WebhookIgnore;
  capabilities!: CapabilityExport[];

  image: string;
  buildTimestamp: string;
  hash: string;

  constructor(
    readonly config: ModuleConfig,
    readonly path: string,
    readonly host?: string,
  ) {
    this.name = `pepr-${config.uuid}`;
    this.buildTimestamp = `${Date.now()}`;
    this.alwaysIgnore = config.alwaysIgnore;
    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;
    this.hash = "";
    // Generate the ephemeral tls things
    this.tls = genTLS(this.host || `${this.name}.pepr-system.svc`);

    // Generate the api token for the controller / webhook
    this.apiToken = crypto.randomBytes(32).toString("hex");
  }

  setHash = (hash: string) => {
    this.hash = hash;
  };

  deploy = async (force: boolean, webhookTimeout?: number) => {
    this.capabilities = await loadCapabilities(this.path);
    await deploy(this, force, webhookTimeout);
  };

  zarfYaml = (path: string) => zarfYaml(this, path);

  zarfYamlChart = (path: string) => zarfYamlChart(this, path);

  allYaml = async (imagePullSecret?: string) => {
    this.capabilities = await loadCapabilities(this.path);
    // give error if namespaces are not respected
    for (const capability of this.capabilities) {
      namespaceComplianceValidator(capability, this.alwaysIgnore?.namespaces);
    }

    return allYaml(this, imagePullSecret);
  };

  generateHelmChart = async (basePath: string) => {
    const helm = helmLayout(basePath, this.config.uuid);

    try {
      await Promise.all(
        Object.values(helm.dirs)
          .sort((l, r) => l.split("/").length - r.split("/").length)
          .map(async dir => await createDirectoryIfNotExists(dir)),
      );

      const code = await fs.readFile(this.path);

      const pairs: [string, () => string][] = [
        [helm.files.chartYaml, () => dedent(chartYaml(this.config.uuid, this.config.description || ""))],
        [helm.files.namespaceYaml, () => dedent(nsTemplate())],
        [helm.files.watcherServiceYaml, () => toYaml(watcherService(this.name))],
        [helm.files.admissionServiceYaml, () => toYaml(service(this.name))],
        [helm.files.tlsSecretYaml, () => toYaml(tlsSecret(this.name, this.tls))],
        [helm.files.apiTokenSecretYaml, () => toYaml(apiTokenSecret(this.name, this.apiToken))],
        [helm.files.storeRoleYaml, () => toYaml(storeRole(this.name))],
        [helm.files.storeRoleBindingYaml, () => toYaml(storeRoleBinding(this.name))],
        [helm.files.clusterRoleYaml, () => dedent(clusterRoleTemplate())],
        [helm.files.clusterRoleBindingYaml, () => toYaml(clusterRoleBinding(this.name))],
        [helm.files.serviceAccountYaml, () => toYaml(serviceAccount(this.name))],
        [helm.files.moduleSecretYaml, () => toYaml(moduleSecret(this.name, code, this.hash))],
      ];
      await Promise.all(pairs.map(async ([file, content]) => await fs.writeFile(file, content())));

      await overridesFile(this, helm.files.valuesYaml);

      const [mutateWebhook, validateWebhook] = await Promise.all([
        webhookConfig(this, "mutate", this.config.webhookTimeout),
        webhookConfig(this, "validate", this.config.webhookTimeout),
      ]);

      if (validateWebhook || mutateWebhook) {
        await fs.writeFile(helm.files.admissionDeploymentYaml, dedent(admissionDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(helm.files.admissionServiceMonitorYaml, dedent(serviceMonitorTemplate("admission")));
      }

      if (mutateWebhook) {
        await fs.writeFile(helm.files.mutationWebhookYaml, webhookYaml(this, mutateWebhook));
      }

      if (validateWebhook) {
        await fs.writeFile(helm.files.validationWebhookYaml, webhookYaml(this, validateWebhook));
      }

      const watchDeployment = watcher(this, this.hash, this.buildTimestamp);
      if (watchDeployment) {
        await fs.writeFile(helm.files.watcherDeploymentYaml, dedent(watcherDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(helm.files.watcherServiceMonitorYaml, dedent(serviceMonitorTemplate("watcher")));
      }
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
