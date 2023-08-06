// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { GenericClass } from "../types";
import { modelToGroupVersionKind } from "./kinds";
import { GroupVersionKind } from "./types";

export interface Filters {
  kindOverride?: GroupVersionKind;
  labelSelector?: string;
  name?: string;
  namespace?: string;
}

export type QueryParams = Record<string, string | number | boolean>;

/**
 * Generate a path to a Kubernetes resource
 *
 * @param model
 * @param opts
 * @returns
 */
export function pathBuilder<T extends GenericClass>(model: T, opts: Filters) {
  const matchedKind = opts.kindOverride || modelToGroupVersionKind(model.name);

  // If the kind is not specified and the model is not a KubernetesObject, throw an error
  if (!matchedKind) {
    throw new Error(`Kind not specified for ${model.name}`);
  }

  // Use the plural property if it exists, otherwise use lowercase kind + s
  const plural = matchedKind.plural || `${matchedKind.kind.toLowerCase()}s`;

  let base = "/api/v1";

  // If the kind is not in the core group, add the group and version to the path
  if (matchedKind.group) {
    if (!matchedKind.version) {
      throw new Error(`Version not specified for ${model.name}`);
    }

    base = `/apis/${matchedKind.group}/${matchedKind.version}`;
  }

  // Namespaced paths require a namespace prefix
  const namespace = opts.namespace ? `namespaces/${opts.namespace}` : "";

  // Build the complete path to the resource
  const path = [base, namespace, plural, opts.name].filter(Boolean).join("/");

  return path;
}

// function Get<T extends GenericClass>(model: T, kindOverride?: GroupVersionKind) {
//   const fluent = { InNamespace, WithLabel, WithAnnotation, WithName, then };
//   const filters: Filters = {
//     kindOverride,
//   };

//   function InNamespace(namespaces: string) {
//     filters.namespace = namespaces;
//     return fluent;
//   }

//   function WithName(name: string) {
//     filters.name = name;
//     return fluent;
//   }

//   function WithLabel(key: string, value = "") {
//     filters.labels[key] = value;
//     return fluent;
//   }

//   function WithAnnotation(key: string, value = "") {
//     filters.annotations[key] = value;
//     return fluent;
//   }

//   async function then(resolve: (val: InstanceType<T>) => void, reject: (e: Error) => void) {
//     try {
//       kc.getClusterCustomObject(group, version, api, filters.name);

//       resolve({} as InstanceType<T>);
//     } catch (e) {
//       reject(e);
//     }
//   }

//   return fluent;
// }

// Get(a.ConfigMap)
//   .InNamespace("pepr-system")
//   .WithName("pepr-config")
//   .then(config => {
//     Log.info(config);
//   });

// const Kube = {Get};

// const cm = await Kube.Get(a.ConfigMap)
//     .InNamespace("pepr-system")
//     .WithName("pepr-config")
//     .Run()

// Kube.(a.ConfigMap)
