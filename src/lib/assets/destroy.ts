// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, kind } from "kubernetes-fluent-client";

import Log from "../telemetry/logger";
import { peprStoreCRD } from "./store";

export async function destroyModule(name: string) {
  const namespace = "pepr-system";

  Log.info("Destroying Pepr module");

  await Promise.all([
    K8s(kind.MutatingWebhookConfiguration).Delete(name),
    K8s(kind.ValidatingWebhookConfiguration).Delete(name),

    K8s(kind.CustomResourceDefinition).Delete(peprStoreCRD),
    K8s(kind.ClusterRoleBinding).Delete(name),
    K8s(kind.ClusterRole).Delete(name),
    K8s(kind.ServiceAccount, { namespace }).Delete(name),
    K8s(kind.Role, { namespace }).Delete(name),
    K8s(kind.RoleBinding, { namespace }).Delete(`${name}-store`),

    K8s(kind.Secret, { namespace }).Delete(`${name}-module`),
    K8s(kind.Service, { namespace }).Delete(name),
    K8s(kind.Secret, { namespace }).Delete(`${name}-tls`),
    K8s(kind.Secret, { namespace }).Delete(`${name}-api-token`),
    K8s(kind.Deployment, { namespace }).Delete(name),
    K8s(kind.Deployment, { namespace }).Delete(`${name}-watcher`),
    K8s(kind.Service, { namespace }).Delete(`${name}-watcher`),
  ]);
}
