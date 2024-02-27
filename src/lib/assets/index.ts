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
import { allYaml, zarfYaml, overridesFile } from "./yaml";
import { namespaceComplianceValidator, replaceString } from "../helpers";
import { createDirectoryIfNotExists, dedent } from "../helpers";
import { resolve } from "path";
import { chartYaml, nsTemplate, admissionSVCTemplate, watcherSVCTemplate, admissionDeployTemplate, watcherDeployTemplate } from "./helm";
import { promises as fs } from "fs";
import { webhookConfig } from "./webhooks";
import { watcher } from "./pods";

export class Assets {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiToken: string;
  readonly alwaysIgnore!: WebhookIgnore;
  capabilities!: CapabilityExport[];

  image: string;

  hash: string;

  constructor(
    readonly config: ModuleConfig,
    readonly path: string,
    readonly host?: string,
  ) {
    this.name = `pepr-${config.uuid}`;
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

  allYaml = async (rbacMode: string) => {
    this.capabilities = await loadCapabilities(this.path);
    // give error if namespaces are not respected
    for (const capability of this.capabilities) {
      namespaceComplianceValidator(capability, this.alwaysIgnore.namespaces);
    }

    return allYaml(this, rbacMode);
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
    const watcherDeployPath = resolve(CHAR_TEMPLATES_DIR, `watcher-deployment.yaml`);
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
      await fs.writeFile(chartPath, chartYaml(this.config.uuid, this.config.description || ""));

      // create the namespace.yaml in templates
      await fs.writeFile(nsPath, dedent(nsTemplate()));
      await fs.writeFile(watcherSVCPath, dedent(watcherSVCTemplate()));
      await fs.writeFile(admissionSVCPath, dedent(admissionSVCTemplate()));


      const mutateWebhook = await webhookConfig(this, "mutate", this.config.webhookTimeout);
      const validateWebhook = await webhookConfig(this, "validate", this.config.webhookTimeout);
      const watchDeployment = watcher(this, this.hash);

      if(validateWebhook || mutateWebhook) {
        await fs.writeFile(admissionDeployPath, dedent(admissionDeployTemplate()));
      }

      if(mutateWebhook) {
        let yamlMutateWebhook = dumpYaml(mutateWebhook, { noRefs: true });
        let mutateWebhookTemplate = replaceString(yamlMutateWebhook, this.config.uuid, "{{ .Values.uuid }}");
        await fs.writeFile(mutationWebhookPath, mutateWebhookTemplate);
      }

      if(validateWebhook) {
        let yamlValidateWebhook = dumpYaml(validateWebhook, { noRefs: true });
        let mutateWebhookTemplate = replaceString(yamlValidateWebhook, this.config.uuid, "{{ .Values.uuid }}");
        await fs.writeFile(mutationWebhookPath, mutateWebhookTemplate);
      }

      if(watchDeployment) {
        await fs.writeFile(watcherDeployPath, dedent(watcherDeployTemplate()));
      }

      // if(mutateWebhook) {
      //   await fs.writeFile(`${CHAR_TEMPLATES_DIR}/mutatingwebhookconfiguration.yaml`, mutateWebhook);
      // }

      // await overridesFile(valuesPath, this.config);
      //await createDirectoryIfNotExists(`${CHART_DIR}/values.yaml`)
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
