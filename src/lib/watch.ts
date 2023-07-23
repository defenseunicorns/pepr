// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Watch as K8sWatch, KubeConfig } from "@kubernetes/client-node";
import { clone } from "ramda";

import { modelToGroupVersionKind } from "./k8s";
import { GroupVersionKind } from "./k8s/types";
import Log from "./logger";
import { GenericClass, WatchAction, WatchPhase } from "./types";

export interface WatchOptions {
  customKind?: GroupVersionKind;
  labelSelector?: string;
  name?: string;
  namespace?: string;
  phases?: WatchPhase[];
}

/**
 * Watch Kubernetes resources outside of the admission controller lifecycle.
 * This is useful for resources that may exist before the admission controller is started.
 */
export const SimpleWatch = <T extends GenericClass>(model: T, opts: WatchOptions) => {
  const matchedKind = opts.customKind || modelToGroupVersionKind(model.name);
  const prefix = `watch: ${model.name}`;

  // If the kind is not specified and the model is not a KubernetesObject, throw an error
  if (!matchedKind) {
    throw new Error(`Kind not specified for ${model.name}`);
  }

  // Nothing happens until the OnChange function is called
  function Start(callback: WatchAction<T>) {
    Log.info(`Watch started`, prefix);
    Log.debug(callback.toString(), prefix);

    // Setup K8s client
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();
    const { watch } = new K8sWatch(kubeConfig);

    // Use the plural property if it exists, otherwise use lowercase kind + s
    const resource = matchedKind.plural || `${matchedKind.kind.toLowerCase()}s`;

    let base = "/api/v1";
    let queryParams = {};

    // If the kind is not in the core group, add the group and version to the path
    if (matchedKind.group !== "" || matchedKind.version !== "v1") {
      base = `/apis/${matchedKind.group}/${matchedKind.version}`;
    }

    // Build the complete path to the resource
    const path = [base, opts.namespace, resource, opts.name].filter(Boolean).join("/");

    // If a label selector is specified, add it to the query params
    if (opts.labelSelector) {
      queryParams = { labelSelector: opts.labelSelector };
    }

    // Create the watcher
    return watch(
      path,
      queryParams,
      (phase, payload) => {
        Log.info(`Watch event received for phase ${phase}`, prefix);
        Log.debug(payload, prefix);

        const phaseMatch = phase as WatchPhase;

        // Perform the callback if no phases are specified or the phase matches
        if (!opts.phases || opts.phases.includes(phaseMatch)) {
          callback(clone(payload), phaseMatch);
        } else {
          Log.info(`Unmatched phase ${phase}, skipping watch action`, prefix);
        }
      },
      err => {
        Log.error(err, prefix);
      },
    );
  }

  return { Start };
};
