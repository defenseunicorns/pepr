// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Watch as K8sWatch, KubeConfig } from "@kubernetes/client-node";
import { clone } from "ramda";

import Log from "../logger";
import { GenericClass, WatchAction, WatchPhase } from "../types";
import { Filters, QueryParams, pathBuilder } from "./raw";

export interface WatchOptions extends Filters {
  phases?: WatchPhase[];
}

/**
 * Watch Kubernetes resources outside of the admission controller lifecycle.
 * This is useful for resources that may exist before the admission controller is started.
 */
export const SimpleWatch = <T extends GenericClass>(model: T, opts: WatchOptions) => {
  const prefix = `watch: ${model.name}`;

  // Nothing happens until the OnChange function is called
  function Start(callback: WatchAction<T>) {
    Log.info(`Watch started`, prefix);
    Log.debug(callback.toString(), prefix);

    // Setup K8s client
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();
    const k = new K8sWatch(kubeConfig);

    // Extract the name from the options
    const { name } = opts;

    // Remove the name from the options so it doesn't get added to the path
    delete opts.name;

    const queryParams: QueryParams = {
      allowWatchBookmarks: true,
    };

    // If a label selector is specified, add it to the query params
    if (opts.labelSelector) {
      queryParams.labelSelector = opts.labelSelector;
    }

    // If a name is specified, add it to the query params
    if (name) {
      queryParams.fieldSelector = `metadata.name=${name}`;
    }

    // Build the path to the resource
    const path = pathBuilder(model, opts);

    Log.info(`Watching ${path}`, prefix);

    // Create the watcher
    return k.watch(
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
        throw err;
      },
    );
  }

  return { Start };
};
