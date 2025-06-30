import crypto from "crypto";
import { CapabilityExport } from "../types";
import { ModuleConfig } from "../types";
import { TLSOut, genTLS } from "../tls";
import { WebhookIgnore } from "../k8s";
import {
  chartYaml,
  namespaceTemplate,
  clusterRoleTemplate,
  admissionDeployTemplate,
  serviceTemplate,
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
import { helmLayout, createWebhookYaml, toYaml } from "./index";
import { loadCapabilities } from "./loader";
import { namespaceComplianceValidator, dedent } from "../helpers";
import { promises as fs } from "fs";
import { storeRole, storeRoleBinding, clusterRoleBinding, serviceAccount } from "./rbac";
import { tlsSecret, apiPathSecret } from "./networking";
import { WebhookType } from "../enums";
import { kind } from "kubernetes-fluent-client";

export function isAdmission(capabilities: CapabilityExport[]): boolean {
  for (const capability of capabilities) {
    const admissionBindings = capability.bindings.filter(
      binding => binding.isFinalize || binding.isMutate || binding.isValidate,
    );
    if (admissionBindings.length > 0) {
      return true;
    }
  }
  return false;
}
export function isWatcher(capabilities: CapabilityExport[]): boolean {
  for (const capability of capabilities) {
    if (capability.hasSchedule) {
      return true;
    }
    const watcherBindings = capability.bindings.filter(
      binding => binding.isFinalize || binding.isWatch || binding.isQueue,
    );
    if (watcherBindings.length > 0) {
      return true;
    }
  }
  return false;
}

export class Assets {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiPath: string;
  readonly config: ModuleConfig;
  readonly path: string;
  readonly alwaysIgnore!: WebhookIgnore;
  readonly imagePullSecrets: string[];
  capabilities!: CapabilityExport[];
  image: string;
  buildTimestamp: string;
  readonly host?: string;

  constructor(config: ModuleConfig, path: string, imagePullSecrets: string[], host?: string) {
    this.name = `pepr-${config.uuid}`;
    this.imagePullSecrets = imagePullSecrets;
    this.buildTimestamp = `${Date.now()}`;
    this.config = config;
    this.path = path;
    this.host = host;
    this.alwaysIgnore = config.alwaysIgnore;
    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;

    // Generate the ephemeral tls things
    this.tls = genTLS(host || `${this.name}.pepr-system.svc`);

    // Generate the api path for the controller / webhook
    this.apiPath = crypto.randomBytes(32).toString("hex");
  }

  async deploy(
    deployFunction: (assets: Assets, force: boolean, webhookTimeout: number) => Promise<void>,
    force: boolean,
    webhookTimeout?: number,
  ): Promise<void> {
    this.capabilities = await loadCapabilities(this.path);

    const timeout = typeof webhookTimeout === "number" ? webhookTimeout : 10;

    await deployFunction(this, force, timeout);
  }

  zarfYaml = (
    zarfYamlGenerator: (assets: Assets, path: string, type: "manifests" | "charts") => string,
    path: string,
  ): string => zarfYamlGenerator(this, path, "manifests");

  zarfYamlChart = (
    zarfYamlGenerator: (assets: Assets, path: string, type: "manifests" | "charts") => string,
    path: string,
  ): string => zarfYamlGenerator(this, path, "charts");

  allYaml = async (
    yamlGenerationFunction: (
      assets: Assets,
      deployments: { admission: V1Deployment | null; watch: V1Deployment | null },
      services: { admission: kind.Service | null; watch: kind.Service | null },
    ) => Promise<string>,
    getControllerManifests: {
      getDeploymentFunction: (
        assets: Assets,
        hash: string,
        buildTimestamp: string,
        imagePullSecret?: string,
      ) => kind.Deployment | null;
      getWatcherFunction: (
        assets: Assets,
        hash: string,
        buildTimestamp: string,
        imagePullSecret?: string,
      ) => kind.Deployment | null;
      getServiceFunction: (name: string, assets: Assets) => kind.Service | null;
      getWatcherServiceFunction: (name: string, assets: Assets) => kind.Service | null;
    },
    imagePullSecret?: string,
  ): Promise<string> => {
    this.capabilities = await loadCapabilities(this.path);
    // give error if namespaces are not respected
    for (const capability of this.capabilities) {
      // until deployment, Pepr does not distinguish between watch and admission
      namespaceComplianceValidator(capability, this.alwaysIgnore?.namespaces);
      namespaceComplianceValidator(
        capability,
        this.config.admission?.alwaysIgnore?.namespaces,
        false,
      );
      namespaceComplianceValidator(capability, this.config.watch?.alwaysIgnore?.namespaces, true);
    }

    const code = await fs.readFile(this.path);

    const moduleHash = crypto.createHash("sha256").update(code).digest("hex");

    const deployments = {
      admission: getControllerManifests.getDeploymentFunction(
        this,
        moduleHash,
        this.buildTimestamp,
        imagePullSecret,
      ),
      watch: getControllerManifests.getWatcherFunction(
        this,
        moduleHash,
        this.buildTimestamp,
        imagePullSecret,
      ),
    };

    const services = {
      admission: getControllerManifests.getServiceFunction(this.name, this),
      watch: getControllerManifests.getWatcherServiceFunction(this.name, this),
    };

    return yamlGenerationFunction(this, deployments, services);
  };

  writeWebhookFiles = async (
    validateWebhook: V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null,
    mutateWebhook: V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null,
    helm: Record<string, Record<string, string>>,
  ): Promise<void> => {
    if (validateWebhook || mutateWebhook) {
      await fs.writeFile(
        helm.files.admissionDeploymentYaml,
        dedent(admissionDeployTemplate(this.buildTimestamp, "admission")),
      );
      await fs.writeFile(
        helm.files.admissionServiceMonitorYaml,
        dedent(
          serviceMonitorTemplate(
            process.env.PEPR_CUSTOM_BUILD_NAME
              ? `admission-${process.env.PEPR_CUSTOM_BUILD_NAME}`
              : "admission",
            `admission`,
          ),
        ),
      );
    }

    if (mutateWebhook) {
      await fs.writeFile(
        helm.files.mutationWebhookYaml,
        createWebhookYaml(this.name, this.config, mutateWebhook),
      );
    }

    if (validateWebhook) {
      await fs.writeFile(
        helm.files.validationWebhookYaml,
        createWebhookYaml(this.name, this.config, validateWebhook),
      );
    }
  };

  generateHelmChart = async (
    webhookGeneratorFunction: (
      assets: Assets,
      mutateOrValidate: WebhookType,
      timeoutSeconds: number | undefined,
    ) => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>,
    getWatcherFunction: (
      assets: Assets,
      hash: string,
      buildTimestamp: string,
      imagePullSecret?: string,
    ) => kind.Deployment | null,
    getModuleSecretFunction: (name: string, data: Buffer, hash: string) => kind.Secret,
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
      const moduleHash = crypto.createHash("sha256").update(code).digest("hex");

      const pairs: [string, () => string][] = [
        [
          helm.files.chartYaml,
          (): string => dedent(chartYaml(this.config.uuid, this.config.description || "")),
        ],
        [helm.files.namespaceYaml, (): string => dedent(namespaceTemplate())],
        [
          helm.files.watcherServiceYaml,
          (): string => dedent(serviceTemplate(this.name, "watcher")),
        ],
        [
          helm.files.admissionServiceYaml,
          (): string => dedent(serviceTemplate(this.name, "admission")),
        ],
        [helm.files.tlsSecretYaml, (): string => toYaml(tlsSecret(this.name, this.tls))],
        [
          helm.files.apiPathSecretYaml,
          (): string => toYaml(apiPathSecret(this.name, this.apiPath)),
        ],
        [helm.files.storeRoleYaml, (): string => toYaml(storeRole(this.name))],
        [helm.files.storeRoleBindingYaml, (): string => toYaml(storeRoleBinding(this.name))],
        [helm.files.clusterRoleYaml, (): string => dedent(clusterRoleTemplate())],
        [helm.files.clusterRoleBindingYaml, (): string => toYaml(clusterRoleBinding(this.name))],
        [helm.files.serviceAccountYaml, (): string => toYaml(serviceAccount(this.name))],
        [
          helm.files.moduleSecretYaml,
          (): string => toYaml(getModuleSecretFunction(this.name, code, moduleHash)),
        ],
      ];
      await Promise.all(pairs.map(async ([file, content]) => await fs.writeFile(file, content())));

      const overrideData = {
        hash: moduleHash,
        name: this.name,
        image: this.image,
        config: this.config,
        apiPath: this.apiPath,
        capabilities: this.capabilities,
      };
      await overridesFile(overrideData, helm.files.valuesYaml, this.imagePullSecrets, {
        admission: isAdmission(this.capabilities),
        watcher: isWatcher(this.capabilities),
      });

      const webhooks = {
        mutate: await webhookGeneratorFunction(
          this,
          WebhookType.MUTATE,
          this.config.webhookTimeout,
        ),
        validate: await webhookGeneratorFunction(
          this,
          WebhookType.VALIDATE,
          this.config.webhookTimeout,
        ),
      };

      await this.writeWebhookFiles(webhooks.validate, webhooks.mutate, helm);

      const watchDeployment = getWatcherFunction(this, moduleHash, this.buildTimestamp);
      if (watchDeployment) {
        await fs.writeFile(
          helm.files.watcherDeploymentYaml,
          dedent(watcherDeployTemplate(this.buildTimestamp, "watcher")),
        );
        await fs.writeFile(
          helm.files.watcherServiceMonitorYaml,
          dedent(
            serviceMonitorTemplate(
              process.env.PEPR_CUSTOM_BUILD_NAME
                ? `watcher-${process.env.PEPR_CUSTOM_BUILD_NAME}`
                : "watcher",
              `watcher`,
            ),
          ),
        );
      }
    } catch (err) {
      throw new Error(`Error generating helm chart: ${err.message}`);
    }
  };
}
