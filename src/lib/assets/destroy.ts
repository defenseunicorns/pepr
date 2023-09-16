// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Kube } from "../k8s/fluent/kube";
import {
  ClusterRole,
  ClusterRoleBinding,
  CustomResourceDefinition,
  Deployment,
  MutatingWebhookConfiguration,
  Role,
  RoleBinding,
  Secret,
  Service,
  ServiceAccount,
  ValidatingWebhookConfiguration,
} from "../k8s/upstream";
import Log from "../logger";
import { peprStoreCRD } from "./store";

export async function destroyModule(name: string) {
  const ns = "pepr-system";

  Log.info("Destroying Pepr module");

  await Kube(MutatingWebhookConfiguration).Delete(name);
  await Kube(ValidatingWebhookConfiguration).Delete(name);

  await Kube(CustomResourceDefinition).Delete(peprStoreCRD);
  await Kube(ClusterRoleBinding).Delete(name);
  await Kube(ClusterRole).Delete(name);
  await Kube(ServiceAccount).InNamespace(ns).Delete(name);
  await Kube(Role).InNamespace(ns).Delete(name);
  await Kube(RoleBinding).InNamespace(ns).Delete(`${name}-store`);

  await Kube(Secret).InNamespace(ns).Delete(`${name}-module`);
  await Kube(Service).InNamespace(ns).Delete(name);
  await Kube(Secret).InNamespace(ns).Delete(`${name}-tls`);
  await Kube(Secret).InNamespace(ns).Delete(`${name}-api-token`);
  await Kube(Deployment).InNamespace(ns).Delete(name);
  await Kube(Deployment).InNamespace(ns).Delete(`${name}-watcher`);
  await Kube(Service).InNamespace(ns).Delete(`${name}-watcher`);
}
