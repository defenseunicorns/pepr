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
    const CHART_DIR = `${basePath}/${this.config.uuid}-chart`;
    const CHAR_TEMPLATES_DIR = `${CHART_DIR}/templates`;
    const valuesPath = resolve(CHART_DIR, `values.yaml`);
    const chartPath = resolve(CHART_DIR, `Chart.yaml`);
    const nsPath = resolve(CHAR_TEMPLATES_DIR, `namespace.yaml`);
    const watcherSVCPath = resolve(CHAR_TEMPLATES_DIR, `watcher-service.yaml`);
    const admissionSVCPath = resolve(CHAR_TEMPLATES_DIR, `admission-service.yaml`);
    const mutationWebhookPath = resolve(CHAR_TEMPLATES_DIR, `mutation-webhook.yaml`);
    const validationWebhookPath = resolve(CHAR_TEMPLATES_DIR, `validation-webhook.yaml`);
    const admissionDeployPath = resolve(CHAR_TEMPLATES_DIR, `admission-deployment.yaml`);
    const admissionServiceMonitorPath = resolve(CHAR_TEMPLATES_DIR, `admission-service-monitor.yaml`);
    const watcherDeployPath = resolve(CHAR_TEMPLATES_DIR, `watcher-deployment.yaml`);
    const watcherServiceMonitorPath = resolve(CHAR_TEMPLATES_DIR, `watcher-service-monitor.yaml`);
    const tlsSecretPath = resolve(CHAR_TEMPLATES_DIR, `tls-secret.yaml`);
    const apiTokenSecretPath = resolve(CHAR_TEMPLATES_DIR, `api-token-secret.yaml`);
    const moduleSecretPath = resolve(CHAR_TEMPLATES_DIR, `module-secret.yaml`);
    const storeRolePath = resolve(CHAR_TEMPLATES_DIR, `store-role.yaml`);
    const storeRoleBindingPath = resolve(CHAR_TEMPLATES_DIR, `store-role-binding.yaml`);
    const clusterRolePath = resolve(CHAR_TEMPLATES_DIR, `cluster-role.yaml`);
    const clusterRoleBindingPath = resolve(CHAR_TEMPLATES_DIR, `cluster-role-binding.yaml`);
    const serviceAccountPath = resolve(CHAR_TEMPLATES_DIR, `service-account.yaml`);

    // create helm chart
    try {
      // create chart dir
      await createDirectoryIfNotExists(CHART_DIR);

      // create charts dir
      await createDirectoryIfNotExists(`${CHART_DIR}/charts`);

      // create templates dir
      await createDirectoryIfNotExists(`${CHAR_TEMPLATES_DIR}`);

      // create values file
      await overridesFile(this, valuesPath);

      // create the chart.yaml
      await fs.writeFile(chartPath, dedent(chartYaml(this.config.uuid, this.config.description || "")));

      // create the namespace.yaml in templates
      await fs.writeFile(nsPath, dedent(nsTemplate()));

      const code = await fs.readFile(this.path);

      await fs.writeFile(watcherSVCPath, dumpYaml(watcherService(this.name), { noRefs: true }));
      await fs.writeFile(admissionSVCPath, dumpYaml(service(this.name), { noRefs: true }));
      await fs.writeFile(tlsSecretPath, dumpYaml(tlsSecret(this.name, this.tls), { noRefs: true }));
      await fs.writeFile(apiTokenSecretPath, dumpYaml(apiTokenSecret(this.name, this.apiToken), { noRefs: true }));
      await fs.writeFile(moduleSecretPath, dumpYaml(moduleSecret(this.name, code, this.hash), { noRefs: true }));
      await fs.writeFile(storeRolePath, dumpYaml(storeRole(this.name), { noRefs: true }));
      await fs.writeFile(storeRoleBindingPath, dumpYaml(storeRoleBinding(this.name), { noRefs: true }));
      await fs.writeFile(clusterRolePath, dedent(clusterRoleTemplate()));
      await fs.writeFile(clusterRoleBindingPath, dumpYaml(clusterRoleBinding(this.name), { noRefs: true }));
      await fs.writeFile(serviceAccountPath, dumpYaml(serviceAccount(this.name), { noRefs: true }));

      const mutateWebhook = await webhookConfig(this, "mutate", this.config.webhookTimeout);
      const validateWebhook = await webhookConfig(this, "validate", this.config.webhookTimeout);
      const watchDeployment = watcher(this, this.hash, this.buildTimestamp);

      if (validateWebhook || mutateWebhook) {
        await fs.writeFile(admissionDeployPath, dedent(admissionDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(admissionServiceMonitorPath, dedent(serviceMonitorTemplate("admission")));
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
        await fs.writeFile(mutationWebhookPath, mutateWebhookTemplate);
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
        await fs.writeFile(validationWebhookPath, validateWebhookTemplate);
      }

      if (watchDeployment) {
        await fs.writeFile(watcherDeployPath, dedent(watcherDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(watcherServiceMonitorPath, dedent(serviceMonitorTemplate("watcher")));
      }
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
