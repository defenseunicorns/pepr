import crypto from "crypto";
import { CapabilityExport } from "../types";
import { ModuleConfig } from "../core/module";
import { TLSOut, genTLS } from "../tls";
import { WebhookIgnore } from "../k8s";
import {
  chartYaml,
  namespaceTemplate,
  clusterRoleTemplate,
  admissionDeployTemplate,
  serviceMonitorTemplate,
  watcherDeployTemplate,
} from "./helm";
import {
  V1Deployment,
  V1MutatingWebhookConfiguration,
  V1ValidatingWebhookConfiguration,
} from "@kubernetes/client-node/dist/gen";
import { createDirectoryIfNotExists } from "../filesystemService";
import { overridesFile } from "./yaml/overridesFile";
import { getDeployment, getModuleSecret, getWatcher } from "./pods";
import { helmLayout, createWebhookYaml, toYaml } from "./index";
import { loadCapabilities } from "./loader";
import { namespaceComplianceValidator, dedent } from "../helpers";
import { promises as fs } from "fs";
import { storeRole, storeRoleBinding, clusterRoleBinding, serviceAccount } from "./rbac";
import { watcherService, service, tlsSecret, apiTokenSecret } from "./networking";
import { generateZarfYamlChart } from "./yaml/generateZarfYamlChart";
import { generateZarfYaml } from "./yaml/generateZarfYaml";

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

  setHash = (hash: string): void => {
    this.hash = hash;
  };

  async deploy(
    deployFunction: (assets: Assets, force: boolean, webhookTimeout?: number) => Promise<void>,
    force: boolean,
    webhookTimeout?: number,
  ): Promise<void> {
    this.capabilities = await loadCapabilities(this.path);
    await deployFunction(this, force, webhookTimeout);
  }

  zarfYaml = (path: string): string => generateZarfYaml(this.name, this.image, this.config, path);

  zarfYamlChart = (path: string): string => generateZarfYamlChart(this.name, this.image, this.config, path);

  allYaml = async (
    yamlGenerationFunction: (
      assyts: Assets,
      deployments: { default: V1Deployment; watch: V1Deployment | null },
    ) => Promise<string>,
    imagePullSecret?: string,
  ): Promise<string> => {
    this.capabilities = await loadCapabilities(this.path);
    // give error if namespaces are not respected
    for (const capability of this.capabilities) {
      namespaceComplianceValidator(capability, this.alwaysIgnore?.namespaces);
    }

    const code = await fs.readFile(this.path);

    // Generate a hash of the code
    this.hash = crypto.createHash("sha256").update(code).digest("hex");

    const deployments = {
      default: getDeployment(this, this.hash, this.buildTimestamp, imagePullSecret),
      watch: getWatcher(this, this.hash, this.buildTimestamp, imagePullSecret),
    };

    return yamlGenerationFunction(this, deployments);
  };

  writeWebhookFiles = async (
    validateWebhook: V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null,
    mutateWebhook: V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null,
    helm: Record<string, Record<string, string>>,
  ): Promise<void> => {
    if (validateWebhook || mutateWebhook) {
      await fs.writeFile(helm.files.admissionDeploymentYaml, dedent(admissionDeployTemplate(this.buildTimestamp)));
      await fs.writeFile(helm.files.admissionServiceMonitorYaml, dedent(serviceMonitorTemplate("admission")));
    }

    if (mutateWebhook) {
      await fs.writeFile(helm.files.mutationWebhookYaml, createWebhookYaml(this.name, this.config, mutateWebhook));
    }

    if (validateWebhook) {
      await fs.writeFile(helm.files.validationWebhookYaml, createWebhookYaml(this.name, this.config, validateWebhook));
    }
  };

  generateHelmChart = async (
    webhookGeneratorFunction: (
      assets: Assets,
      mutateOrValidate: "mutate" | "validate",
      timeoutSeconds: number | undefined,
    ) => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>,
    basePath: string,
  ): Promise<void> => {
    const helm = helmLayout(basePath, this.config.uuid);

    try {
      await Promise.all(
        Object.values(helm.dirs)
          .sort((l, r) => l.split("/").length - r.split("/").length)
          .map(async dir => await createDirectoryIfNotExists(dir)),
      );

      const code = await fs.readFile(this.path);

      const pairs: [string, () => string][] = [
        [helm.files.chartYaml, (): string => dedent(chartYaml(this.config.uuid, this.config.description || ""))],
        [helm.files.namespaceYaml, (): string => dedent(namespaceTemplate())],
        [helm.files.watcherServiceYaml, (): string => toYaml(watcherService(this.name))],
        [helm.files.admissionServiceYaml, (): string => toYaml(service(this.name))],
        [helm.files.tlsSecretYaml, (): string => toYaml(tlsSecret(this.name, this.tls))],
        [helm.files.apiTokenSecretYaml, (): string => toYaml(apiTokenSecret(this.name, this.apiToken))],
        [helm.files.storeRoleYaml, (): string => toYaml(storeRole(this.name))],
        [helm.files.storeRoleBindingYaml, (): string => toYaml(storeRoleBinding(this.name))],
        [helm.files.clusterRoleYaml, (): string => dedent(clusterRoleTemplate())],
        [helm.files.clusterRoleBindingYaml, (): string => toYaml(clusterRoleBinding(this.name))],
        [helm.files.serviceAccountYaml, (): string => toYaml(serviceAccount(this.name))],
        [helm.files.moduleSecretYaml, (): string => toYaml(getModuleSecret(this.name, code, this.hash))],
      ];
      await Promise.all(pairs.map(async ([file, content]) => await fs.writeFile(file, content())));

      const overrideData = {
        hash: this.hash,
        name: this.name,
        image: this.image,
        config: this.config,
        apiToken: this.apiToken,
        capabilities: this.capabilities,
      };
      await overridesFile(overrideData, helm.files.valuesYaml);

      const webhooks = {
        mutate: await webhookGeneratorFunction(this, "mutate", this.config.webhookTimeout),
        validate: await webhookGeneratorFunction(this, "validate", this.config.webhookTimeout),
      };

      await this.writeWebhookFiles(webhooks.validate, webhooks.mutate, helm);

      const watchDeployment = getWatcher(this, this.hash, this.buildTimestamp);
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
