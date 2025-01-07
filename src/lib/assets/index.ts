// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { replaceString } from "../helpers";
import { resolve } from "path";
import { ModuleConfig } from "../core/module";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toYaml(obj: any): string {
  return dumpYaml(obj, { noRefs: true });
}

export function createWebhookYaml(
  name: string,
  config: ModuleConfig,
  webhookConfiguration: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
): string {
  const yaml = toYaml(webhookConfiguration);
  return replaceString(
    replaceString(
      replaceString(yaml, name, "{{ .Values.uuid }}"),
      config.onError === "reject" ? "Fail" : "Ignore",
      "{{ .Values.admission.failurePolicy }}",
    ),
    `${config.webhookTimeout}` || "10",
    "{{ .Values.admission.webhookTimeout }}",
  );
}

export function helmLayout(basePath: string, unique: string): Record<string, Record<string, string>> {
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
