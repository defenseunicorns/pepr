// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Watch as K8sWatch, KubeConfig } from "@kubernetes/client-node";
import { clone } from "ramda";

import { modelToGroupVersionKind } from "./k8s";
import { GroupVersionKind } from "./k8s/types";
import Log from "./logger";
import { GenericClass, WatchAction, WatchPhase } from "./types";

/**
 * Watch Kubernetes resources outside of the admission controller lifecycle.
 * This is useful for resources that may exist before the admission controller is started.
 */
export const After = <T extends GenericClass>(model: T, kind?: GroupVersionKind) => {
  const matchedKind = kind || modelToGroupVersionKind(model.name);
  const prefix = `watch: ${model.name}`;

  // If the kind is not specified and the model is not a KubernetesObject, throw an error
  if (!matchedKind) {
    throw new Error(`Kind not specified for ${model.name}`);
  }

  let namespacePath = "";
  let phases: WatchPhase[] = [];

  // Nothing happens until the OnChange function is called
  function Observe(callback: WatchAction<T>) {
    Log.info(`Binding watch action created`, prefix);
    Log.debug(callback.toString(), prefix);

    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();

    const w = new K8sWatch(kubeConfig);

    let base = "/api/v1";

    // Use the plural property if it exists, otherwise use lowercase kind + s
    const resource = matchedKind.plural || `${matchedKind.kind.toLowerCase()}s`;

    if (matchedKind.group !== "" || matchedKind.version !== "v1") {
      base = `/apis/${matchedKind.group}/${matchedKind.version}`;
    }

    // Build the complete path to the resource
    const path = `${base}/${namespacePath}${resource}`;

    // Create the watcher
    return w.watch(
      path,
      {},
      (phase, payload) => {
        Log.info(`Watch event received for phase ${phase}`, prefix);
        Log.debug(payload, prefix);

        const phaseMatch = phase as WatchPhase;

        // Perform the callback if the phase matches
        if (phases.includes(phaseMatch)) {
          callback(clone(payload), phaseMatch);
        } else {
          Log.info(`Unmatched phase ${phase}, skipping watch action`, prefix);
        }
      },
      err => {
        Log.error(err, prefix);
      }
    );
  }

  /**
   * Optional, specify a namespace to watch resources in
   * @param namespace
   * @returns
   */
  function InNamespace(namespace: string) {
    namespacePath = `namespaces/${namespace}/`;
    return { Observe };
  }

  const bindPhase = (...phase: WatchPhase[]) => {
    phases = phase;
    return {
      InNamespace,
      Observe,
    };
  };

  return {
    IsCreatedOrUpdated: () => bindPhase(WatchPhase.Added, WatchPhase.Modified),
    IsCreated: () => bindPhase(WatchPhase.Added),
    IsUpdated: () => bindPhase(WatchPhase.Modified),
    IsDeleted: () => bindPhase(WatchPhase.Deleted),
  };
};
