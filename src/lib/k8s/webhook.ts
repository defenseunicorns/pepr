// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  AdmissionregistrationV1Api as AdmissionRegV1API,
  AdmissionregistrationV1WebhookClientConfig as AdmissionRegnV1WebhookClientCfg,
  AppsV1Api,
  CoreV1Api,
  HttpError,
  KubeConfig,
  RbacAuthorizationV1Api,
  V1ClusterRole,
  V1ClusterRoleBinding,
  V1Deployment,
  V1LabelSelectorRequirement,
  V1MutatingWebhookConfiguration,
  V1Namespace,
  V1RuleWithOperations,
  V1Secret,
  V1Service,
  V1ServiceAccount,
  V1ValidatingWebhookConfiguration,
  dumpYaml,
} from "@kubernetes/client-node";
import { fork } from "child_process";
import crypto from "crypto";
import { promises as fs } from "fs";
import { concat, equals, uniqWith } from "ramda";
import { gzipSync } from "zlib";

import Log from "../logger";
import { Binding, Event, ModuleConfig } from "../types";
import { TLSOut, genTLS } from "./tls";

const peprIgnoreLabel: V1LabelSelectorRequirement = {
  key: "pepr.dev",
  operator: "NotIn",
  values: ["ignore"],
};

const peprIgnoreNamespaces: string[] = ["kube-system", "pepr-system"];

export class Webhook {
  private name: string;
  private _tls: TLSOut;
  private _apiToken: string;

  public image: string;

  public get tls(): TLSOut {
    return this._tls;
  }

  public get apiToken(): string {
    return this._apiToken;
  }

  constructor(
    private readonly config: ModuleConfig,
    private readonly host?: string,
  ) {
    this.name = `pepr-${config.uuid}`;

    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;

    // Generate the ephemeral tls things
    this._tls = genTLS(this.host || `${this.name}.pepr-system.svc`);

    // Generate the api token for the controller / webhook
    this._apiToken = crypto.randomBytes(32).toString("hex");
  }

  /** Generate the pepr-system namespace */
  namespace(): V1Namespace {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "pepr-system" },
    };
  }

  /**
   * Grants the controller access to cluster resources beyond the mutating webhook.
   *
   * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
   * @returns
   */
  clusterRole(): V1ClusterRole {
    return {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRole",
      metadata: { name: this.name },
      rules: [
        {
          // @todo: make this configurable
          apiGroups: ["*"],
          resources: ["*"],
          verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
        },
      ],
    };
  }

  clusterRoleBinding(): V1ClusterRoleBinding {
    const name = this.name;
    return {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRoleBinding",
      metadata: { name },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name,
          namespace: "pepr-system",
        },
      ],
    };
  }

  serviceAccount(): V1ServiceAccount {
    return {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
      },
    };
  }

  apiTokenSecret(): V1Secret {
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${this.name}-api-token`,
        namespace: "pepr-system",
      },
      type: "Opaque",
      data: {
        value: Buffer.from(this._apiToken).toString("base64"),
      },
    };
  }

  tlsSecret(): V1Secret {
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${this.name}-tls`,
        namespace: "pepr-system",
      },
      type: "kubernetes.io/tls",
      data: {
        "tls.crt": this._tls.crt,
        "tls.key": this._tls.key,
      },
    };
  }

  generateWebhookRules(isMutateWebhook: boolean, path: string): Promise<V1RuleWithOperations[]> {
    return new Promise((resolve, reject) => {
      const rules: V1RuleWithOperations[] = [];

      // Fork is needed with the PEPR_MODE env var to ensure the module is loaded in build mode and will send back the capabilities
      const program = fork(path, {
        env: {
          ...process.env,
          LOG_LEVEL: "warn",
          PEPR_MODE: "build",
        },
      });

      // We are receiving javascript so the private fields are now public
      interface ModuleCapabilities {
        _name: string;
        _description: string;
        _namespaces: string[];
        _bindings: Binding[];
      }

      // Wait for the module to send back the capabilities
      program.on("message", message => {
        // Cast the message to the ModuleCapabilities type
        const capabilities = message.valueOf() as ModuleCapabilities[];

        // Iterate through the capabilities and generate the rules
        for (const capability of capabilities) {
          Log.info(`Module ${this.config.uuid} has capability: ${capability._name}`);

          // Read the bindings and generate the rules
          for (const binding of capability._bindings) {
            const { event, kind, isMutate, isValidate } = binding;

            // If the module doesn't have a callback for the event, skip it
            if (isMutateWebhook && !isMutate) {
              continue;
            }

            if (!isMutateWebhook && !isValidate) {
              continue;
            }

            const operations: string[] = [];

            // CreateOrUpdate is a Pepr-specific event that is translated to Create and Update
            if (event === Event.CreateOrUpdate) {
              operations.push(Event.Create, Event.Update);
            } else {
              operations.push(event);
            }

            // Use the plural property if it exists, otherwise use lowercase kind + s
            const resource = kind.plural || `${kind.kind.toLowerCase()}s`;

            rules.push({
              apiGroups: [kind.group],
              apiVersions: [kind.version || "*"],
              operations,
              resources: [resource],
            });
          }
        }
      });

      program.on("exit", code => {
        if (code !== 0) {
          reject(new Error(`Child process exited with code ${code}`));
        } else {
          // If there are no rules, add a catch-all
          if (rules.length < 1) {
            resolve(rules);
          } else {
            const reducedRules = uniqWith(equals, rules);
            resolve(reducedRules);
          }
        }
      });

      program.on("error", error => {
        reject(error);
      });
    });
  }

  async webhookConfig(
    mutateOrValidate: "mutate" | "validate",
    path: string,
    timeoutSeconds = 10,
  ): Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null> {
    const ignore = [peprIgnoreLabel];

    const ignoreNS = concat(peprIgnoreNamespaces, this.config.alwaysIgnore.namespaces || []);

    // Add any namespaces to ignore
    if (ignoreNS) {
      ignore.push({
        key: "kubernetes.io/metadata.name",
        operator: "NotIn",
        values: ignoreNS,
      });
    }

    const clientConfig: AdmissionRegnV1WebhookClientCfg = {
      caBundle: this._tls.ca,
    };

    // The URL must include the API Token
    const apiPath = `/${mutateOrValidate}/${this._apiToken}`;

    // If a host is specified, use that with a port of 3000
    if (this.host) {
      clientConfig.url = `https://${this.host}:3000${apiPath}`;
    } else {
      // Otherwise, use the service
      clientConfig.service = {
        name: this.name,
        namespace: "pepr-system",
        path: apiPath,
      };
    }

    const isMutate = mutateOrValidate === "mutate";
    const rules = await this.generateWebhookRules(isMutate, path);

    // If there are no rules, return null
    if (rules.length < 1) {
      return null;
    }

    return {
      apiVersion: "admissionregistration.k8s.io/v1",
      kind: isMutate ? "MutatingWebhookConfiguration" : "ValidatingWebhookConfiguration",
      metadata: { name: this.name },
      webhooks: [
        {
          name: `${this.name}.pepr.dev`,
          admissionReviewVersions: ["v1", "v1beta1"],
          clientConfig,
          failurePolicy: "Ignore",
          matchPolicy: "Equivalent",
          timeoutSeconds,
          namespaceSelector: {
            matchExpressions: ignore,
          },
          objectSelector: {
            matchExpressions: ignore,
          },
          rules,
          // @todo: track side effects state
          sideEffects: "None",
        },
      ],
    };
  }

  deployment(hash: string): V1Deployment {
    return {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
        labels: {
          app: this.name,
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            app: this.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: this.name,
            },
          },
          spec: {
            priorityClassName: "system-node-critical",
            serviceAccountName: this.name,
            containers: [
              {
                name: "server",
                image: this.image,
                imagePullPolicy: "IfNotPresent",
                command: ["node", "/app/node_modules/pepr/dist/controller.js", hash],
                livenessProbe: {
                  httpGet: {
                    path: "/healthz",
                    port: 3000,
                    scheme: "HTTPS",
                  },
                },
                ports: [
                  {
                    containerPort: 3000,
                  },
                ],
                resources: {
                  requests: {
                    memory: "64Mi",
                    cpu: "100m",
                  },
                  limits: {
                    memory: "256Mi",
                    cpu: "500m",
                  },
                },
                volumeMounts: [
                  {
                    name: "tls-certs",
                    mountPath: "/etc/certs",
                    readOnly: true,
                  },
                  {
                    name: "api-token",
                    mountPath: "/app/api-token",
                    readOnly: true,
                  },
                  {
                    name: "module",
                    mountPath: `/app/load`,
                    readOnly: true,
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "tls-certs",
                secret: {
                  secretName: `${this.name}-tls`,
                },
              },
              {
                name: "api-token",
                secret: {
                  secretName: `${this.name}-api-token`,
                },
              },
              {
                name: "module",
                secret: {
                  secretName: `${this.name}-module`,
                },
              },
            ],
          },
        },
      },
    };
  }

  service(): V1Service {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
      },
      spec: {
        selector: {
          app: this.name,
        },
        ports: [
          {
            port: 443,
            targetPort: 3000,
          },
        ],
      },
    };
  }

  moduleSecret(data: Buffer, hash: string): V1Secret {
    // Compress the data
    const compressed = gzipSync(data);
    const path = `module-${hash}.js.gz`;
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${this.name}-module`,
        namespace: "pepr-system",
      },
      type: "Opaque",
      data: {
        [path]: compressed.toString("base64"),
      },
    };
  }

  zarfYaml(path: string) {
    const zarfCfg = {
      kind: "ZarfPackageConfig",
      metadata: {
        name: this.name,
        description: `Pepr Module: ${this.config.description}`,
        url: "https://github.com/defenseunicorns/pepr",
        version: `${this.config.appVersion || "0.0.1"}`,
      },
      components: [
        {
          name: "module",
          required: true,
          manifests: [
            {
              name: "module",
              namespace: "pepr-system",
              files: [path],
            },
          ],
          images: [this.image],
        },
      ],
    };

    return dumpYaml(zarfCfg, { noRefs: true });
  }

  async allYaml(path: string) {
    const code = await fs.readFile(path);

    // Generate a hash of the code
    const hash = crypto.createHash("sha256").update(code).digest("hex");

    const mutateWebhook = await this.webhookConfig("mutate", path);
    const validateWebhook = await this.webhookConfig("validate", path);

    const resources = [
      this.namespace(),
      this.clusterRole(),
      this.clusterRoleBinding(),
      this.serviceAccount(),
      this.apiTokenSecret(),
      this.tlsSecret(),
      this.deployment(hash),
      this.service(),
      this.moduleSecret(code, hash),
    ];

    if (mutateWebhook) {
      resources.push(mutateWebhook);
    }

    if (validateWebhook) {
      resources.push(validateWebhook);
    }

    // Convert the resources to a single YAML string
    return resources.map(r => dumpYaml(r, { noRefs: true })).join("---\n");
  }

  async deploy(path: string, webhookTimeout?: number) {
    Log.info("Establishing connection to Kubernetes");

    const namespace = "pepr-system";

    // Deploy the resources using the k8s API
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();

    const coreV1Api = kubeConfig.makeApiClient(CoreV1Api);
    const admissionApi = kubeConfig.makeApiClient(AdmissionRegV1API);

    const ns = this.namespace();
    try {
      Log.info("Checking for namespace");
      await coreV1Api.readNamespace(namespace);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Creating namespace");
      await coreV1Api.createNamespace(ns);
    }

    // Create the mutating webhook configuration if it is needed
    const mutateWebhook = await this.webhookConfig("mutate", path, webhookTimeout);
    if (mutateWebhook) {
      try {
        Log.info("Creating mutating webhook");
        await admissionApi.createMutatingWebhookConfiguration(mutateWebhook);
      } catch (e) {
        Log.debug(e instanceof HttpError ? e.body : e);
        Log.info("Removing and re-creating mutating webhook");
        await admissionApi.deleteMutatingWebhookConfiguration(mutateWebhook.metadata?.name ?? "");
        await admissionApi.createMutatingWebhookConfiguration(mutateWebhook);
      }
    }

    // Create the validating webhook configuration if it is needed
    const validateWebhook = await this.webhookConfig("validate", path, webhookTimeout);
    if (validateWebhook) {
      try {
        Log.info("Creating validating webhook");
        await admissionApi.createValidatingWebhookConfiguration(validateWebhook);
      } catch (e) {
        Log.debug(e instanceof HttpError ? e.body : e);
        Log.info("Removing and re-creating validating webhook");
        await admissionApi.deleteValidatingWebhookConfiguration(validateWebhook.metadata?.name ?? "");
        await admissionApi.createValidatingWebhookConfiguration(validateWebhook);
      }
    }

    // If a host is specified, we don't need to deploy the rest of the resources
    if (this.host) {
      return;
    }

    if (!path) {
      throw new Error("No code provided");
    }

    const code = await fs.readFile(path);

    const hash = crypto.createHash("sha256").update(code).digest("hex");

    const appsApi = kubeConfig.makeApiClient(AppsV1Api);
    const rbacApi = kubeConfig.makeApiClient(RbacAuthorizationV1Api);

    const crb = this.clusterRoleBinding();
    try {
      Log.info("Creating cluster role binding");
      await rbacApi.createClusterRoleBinding(crb);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating cluster role binding");
      await rbacApi.deleteClusterRoleBinding(crb.metadata?.name ?? "");
      await rbacApi.createClusterRoleBinding(crb);
    }

    const cr = this.clusterRole();
    try {
      Log.info("Creating cluster role");
      await rbacApi.createClusterRole(cr);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating  the cluster role");
      try {
        await rbacApi.deleteClusterRole(cr.metadata?.name ?? "");
        await rbacApi.createClusterRole(cr);
      } catch (e) {
        Log.debug(e instanceof HttpError ? e.body : e);
      }
    }

    const sa = this.serviceAccount();
    try {
      Log.info("Creating service account");
      await coreV1Api.createNamespacedServiceAccount(namespace, sa);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating service account");
      await coreV1Api.deleteNamespacedServiceAccount(sa.metadata?.name ?? "", namespace);
      await coreV1Api.createNamespacedServiceAccount(namespace, sa);
    }

    const mod = this.moduleSecret(code, hash);
    try {
      Log.info("Creating module secret");
      await coreV1Api.createNamespacedSecret(namespace, mod);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating module secret");
      await coreV1Api.deleteNamespacedSecret(mod.metadata?.name ?? "", namespace);
      await coreV1Api.createNamespacedSecret(namespace, mod);
    }

    const svc = this.service();
    try {
      Log.info("Creating service");
      await coreV1Api.createNamespacedService(namespace, svc);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating service");
      await coreV1Api.deleteNamespacedService(svc.metadata?.name ?? "", namespace);
      await coreV1Api.createNamespacedService(namespace, svc);
    }

    const tls = this.tlsSecret();
    try {
      Log.info("Creating TLS secret");
      await coreV1Api.createNamespacedSecret(namespace, tls);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating TLS secret");
      await coreV1Api.deleteNamespacedSecret(tls.metadata?.name ?? "", namespace);
      await coreV1Api.createNamespacedSecret(namespace, tls);
    }

    const apiToken = this.apiTokenSecret();
    try {
      Log.info("Creating API token secret");
      await coreV1Api.createNamespacedSecret(namespace, apiToken);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating API token secret");
      await coreV1Api.deleteNamespacedSecret(apiToken.metadata?.name ?? "", namespace);
      await coreV1Api.createNamespacedSecret(namespace, apiToken);
    }

    const dep = this.deployment(hash);
    try {
      Log.info("Creating deployment");
      await appsApi.createNamespacedDeployment(namespace, dep);
    } catch (e) {
      Log.debug(e instanceof HttpError ? e.body : e);
      Log.info("Removing and re-creating deployment");
      await appsApi.deleteNamespacedDeployment(dep.metadata?.name ?? "", namespace);
      await appsApi.createNamespacedDeployment(namespace, dep);
    }
  }
}
