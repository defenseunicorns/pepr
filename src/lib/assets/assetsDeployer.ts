// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AssetsConfig } from "./assetsConfig";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, zarfYaml, zarfYamlChart, overridesFile } from "./yaml";
import { dumpYaml } from "@kubernetes/client-node";
import { createDirectoryIfNotExists, dedent, namespaceComplianceValidator, replaceString } from "../helpers";
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

export class AssetsDeployer {
  constructor(private assetsConfig: AssetsConfig) {}

  async deploy(force: boolean, webhookTimeout?: number) {
    // Load capabilities and trigger the deploy logic
    this.assetsConfig.capabilities = await loadCapabilities(this.assetsConfig.path);
    await deploy(this.assetsConfig, force, webhookTimeout);
  }

  async allYaml(imagePullSecret?: string) {
    this.assetsConfig.capabilities = await loadCapabilities(this.assetsConfig.path);

    // Namespace validation and generating YAMLs
    for (const capability of this.assetsConfig.capabilities) {
      namespaceComplianceValidator(capability, this.assetsConfig.alwaysIgnore?.namespaces);
    }

    return allYaml(this.assetsConfig, imagePullSecret);
  }

  async zarfYaml(path: string) {
    return zarfYaml(this.assetsConfig, path);
  }

  async zarfYamlChart(path: string) {
    return zarfYamlChart(this.assetsConfig, path);
  }

  generateHelmChart = async (basePath: string) => {
    const CHART_DIR = `${basePath}/${this.assetsConfig.config.uuid}-chart`;
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
      await overridesFile(this.assetsConfig, valuesPath);

      // create the chart.yaml
      await fs.writeFile(
        chartPath,
        dedent(chartYaml(this.assetsConfig.config.uuid, this.assetsConfig.config.description || "")),
      );

      // create the namespace.yaml in templates
      await fs.writeFile(nsPath, dedent(nsTemplate()));

      const code = await fs.readFile(this.assetsConfig.path);

      await fs.writeFile(watcherSVCPath, dumpYaml(watcherService(this.assetsConfig.name), { noRefs: true }));
      await fs.writeFile(admissionSVCPath, dumpYaml(service(this.assetsConfig.name), { noRefs: true }));
      await fs.writeFile(
        tlsSecretPath,
        dumpYaml(tlsSecret(this.assetsConfig.name, this.assetsConfig.tls), { noRefs: true }),
      );
      await fs.writeFile(
        apiTokenSecretPath,
        dumpYaml(apiTokenSecret(this.assetsConfig.name, this.assetsConfig.apiToken), { noRefs: true }),
      );
      await fs.writeFile(
        moduleSecretPath,
        dumpYaml(moduleSecret(this.assetsConfig.name, code, this.assetsConfig.hash), { noRefs: true }),
      );
      await fs.writeFile(storeRolePath, dumpYaml(storeRole(this.assetsConfig.name), { noRefs: true }));
      await fs.writeFile(storeRoleBindingPath, dumpYaml(storeRoleBinding(this.assetsConfig.name), { noRefs: true }));
      await fs.writeFile(clusterRolePath, dedent(clusterRoleTemplate()));
      await fs.writeFile(
        clusterRoleBindingPath,
        dumpYaml(clusterRoleBinding(this.assetsConfig.name), { noRefs: true }),
      );
      await fs.writeFile(serviceAccountPath, dumpYaml(serviceAccount(this.assetsConfig.name), { noRefs: true }));

      const mutateWebhook = await webhookConfig(this.assetsConfig, "mutate", this.assetsConfig.config.webhookTimeout);
      const validateWebhook = await webhookConfig(
        this.assetsConfig,
        "validate",
        this.assetsConfig.config.webhookTimeout,
      );

      const watchDeployment = watcher(this.assetsConfig, this.assetsConfig.hash, this.assetsConfig.buildTimestamp);

      if (validateWebhook || mutateWebhook) {
        await fs.writeFile(admissionDeployPath, dedent(admissionDeployTemplate(this.assetsConfig.buildTimestamp)));
        await fs.writeFile(admissionServiceMonitorPath, dedent(serviceMonitorTemplate("admission")));
      }

      if (mutateWebhook) {
        const yamlMutateWebhook = dumpYaml(mutateWebhook, { noRefs: true });
        const mutateWebhookTemplate = replaceString(
          replaceString(
            replaceString(yamlMutateWebhook, this.assetsConfig.name, "{{ .Values.uuid }}"),
            this.assetsConfig.config.onError === "reject" ? "Fail" : "Ignore",
            "{{ .Values.admission.failurePolicy }}",
          ),
          `${this.assetsConfig.config.webhookTimeout}` || "10",
          "{{ .Values.admission.webhookTimeout }}",
        );
        await fs.writeFile(mutationWebhookPath, mutateWebhookTemplate);
      }

      if (validateWebhook) {
        const yamlValidateWebhook = dumpYaml(validateWebhook, { noRefs: true });
        const validateWebhookTemplate = replaceString(
          replaceString(
            replaceString(yamlValidateWebhook, this.assetsConfig.name, "{{ .Values.uuid }}"),
            this.assetsConfig.config.onError === "reject" ? "Fail" : "Ignore",
            "{{ .Values.admission.failurePolicy }}",
          ),
          `${this.assetsConfig.config.webhookTimeout}` || "10",
          "{{ .Values.admission.webhookTimeout }}",
        );
        await fs.writeFile(validationWebhookPath, validateWebhookTemplate);
      }

      if (watchDeployment) {
        await fs.writeFile(watcherDeployPath, dedent(watcherDeployTemplate(this.assetsConfig.buildTimestamp)));
        await fs.writeFile(watcherServiceMonitorPath, dedent(serviceMonitorTemplate("watcher")));
      }
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
