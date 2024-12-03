// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { dumpYaml } from "@kubernetes/client-node";
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
    const helm: Record<string, Record<string, string>> = {
      dirs: {
        chart: resolve(`${basePath}/${this.config.uuid}-chart`),
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

    try {
      await Promise.all(
        Object.values(helm.dirs)
          .sort((l, r) => l.split("/").length - r.split("/").length)
          .map(async dir => await createDirectoryIfNotExists(dir)),
      );

      await overridesFile(this, helm.files.valuesYaml);
      await fs.writeFile(helm.files.chartYaml, dedent(chartYaml(this.config.uuid, this.config.description || "")));
      await fs.writeFile(helm.files.namespaceYaml, dedent(nsTemplate()));

      const code = await fs.readFile(this.path);

      await fs.writeFile(helm.files.watcherServiceYaml, dumpYaml(watcherService(this.name), { noRefs: true }));
      await fs.writeFile(helm.files.admissionServiceYaml, dumpYaml(service(this.name), { noRefs: true }));
      await fs.writeFile(helm.files.tlsSecretYaml, dumpYaml(tlsSecret(this.name, this.tls), { noRefs: true }));
      await fs.writeFile(
        helm.files.apiTokenSecretYaml,
        dumpYaml(apiTokenSecret(this.name, this.apiToken), { noRefs: true }),
      );
      await fs.writeFile(
        helm.files.moduleSecretYaml,
        dumpYaml(moduleSecret(this.name, code, this.hash), { noRefs: true }),
      );
      await fs.writeFile(helm.files.storeRoleYaml, dumpYaml(storeRole(this.name), { noRefs: true }));
      await fs.writeFile(helm.files.storeRoleBindingYaml, dumpYaml(storeRoleBinding(this.name), { noRefs: true }));
      await fs.writeFile(helm.files.clusterRoleYaml, dedent(clusterRoleTemplate()));
      await fs.writeFile(helm.files.clusterRoleBindingYaml, dumpYaml(clusterRoleBinding(this.name), { noRefs: true }));
      await fs.writeFile(helm.files.serviceAccountYaml, dumpYaml(serviceAccount(this.name), { noRefs: true }));

      const mutateWebhook = await webhookConfig(this, "mutate", this.config.webhookTimeout);
      const validateWebhook = await webhookConfig(this, "validate", this.config.webhookTimeout);
      const watchDeployment = watcher(this, this.hash, this.buildTimestamp);

      if (validateWebhook || mutateWebhook) {
        await fs.writeFile(helm.files.admissionDeploymentYaml, dedent(admissionDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(helm.files.admissionServiceMonitorYaml, dedent(serviceMonitorTemplate("admission")));
      }

      if (mutateWebhook) {
        const yamlMutateWebhook = dumpYaml(mutateWebhook, { noRefs: true });
        const mutateWebhookTemplate = replaceString(
          replaceString(
            replaceString(yamlMutateWebhook, this.name, "{{ .Values.uuid }}"),
            this.config.onError === "reject" ? "Fail" : "Ignore",
            "{{ .Values.admission.failurePolicy }}",
          ),
          `${this.config.webhookTimeout}` || "10",
          "{{ .Values.admission.webhookTimeout }}",
        );
        await fs.writeFile(helm.files.mutationWebhookYaml, mutateWebhookTemplate);
      }

      if (validateWebhook) {
        const yamlValidateWebhook = dumpYaml(validateWebhook, { noRefs: true });
        const validateWebhookTemplate = replaceString(
          replaceString(
            replaceString(yamlValidateWebhook, this.name, "{{ .Values.uuid }}"),
            this.config.onError === "reject" ? "Fail" : "Ignore",
            "{{ .Values.admission.failurePolicy }}",
          ),
          `${this.config.webhookTimeout}` || "10",
          "{{ .Values.admission.webhookTimeout }}",
        );
        await fs.writeFile(helm.files.validationWebhookYaml, validateWebhookTemplate);
      }

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
