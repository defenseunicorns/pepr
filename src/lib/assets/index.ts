// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";

import { ModuleConfig } from "../module";
import { TLSOut, genTLS } from "../tls";
import { CapabilityExport } from "../types";
import { WebhookIgnore } from "../k8s";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, zarfYaml, overridesFile } from "./yaml";
import { namespaceComplianceValidator } from "../helpers";
import { createDirectoryIfNotExists, dedent } from "../helpers";
import { resolve } from "path";
import { chartYaml, nsTemplate } from "./helm";
import { promises as fs } from "fs";
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

      // await overridesFile(valuesPath, this.config);
      //await createDirectoryIfNotExists(`${CHART_DIR}/values.yaml`)
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
