// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Watch as K8sWatch, KubeConfig } from "@kubernetes/client-node";
import { clone } from "ramda";

import Log from "../logger";
import { GenericClass, WatchAction, WatchPhase } from "../types";
import { Filters, pathBuilder, queryBuilder } from "./raw";

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

    // Build the path and query params for the resource
    const path = pathBuilder(model, opts);
    const queryParams = queryBuilder(opts);

    // Allow bookmarks to be used for the watch
    queryParams.allowWatchBookmarks = true;

    // If a name is specified, add it to the query params
    if (name) {
      queryParams.fieldSelector = `metadata.name=${name}`;
    }

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
