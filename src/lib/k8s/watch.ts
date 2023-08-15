// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubeConfig, Watch } from "@kubernetes/client-node";
import { clone } from "ramda";

import Log from "../logger";
import { GenericClass, WatchAction, WatchPhase } from "../types";
import { Filters, pathBuilder, queryBuilder } from "./fluent";

export interface WatchOptions extends Filters {
  phases?: WatchPhase[];
}

/**
 * Watch Kubernetes resources from every Pepr Controller pod simultaneously.
 *
 *
 * ⚠️ WARNING ⚠️
 *
 * This watch will run on every Pepr Controller pod at the same time and
 * you should typically use the Pepr Watch CapabilityAction instead unless you
 * really need the watch to run on every controller pod simultaneously.
 */
export const ParallelWatch = <T extends GenericClass>(model: T, opts: WatchOptions) => {
  const prefix = `watch: ${model.name}`;

  // Nothing happens until the OnChange function is called
  function subscribe(callback: WatchAction<T>) {
    Log.info(`Watch started`, prefix);
    Log.debug(callback.toString(), prefix);

    // Setup K8s client
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();
    const k = new Watch(kubeConfig);

    // Build the path and query params for the resource, excluding the name
    const path = pathBuilder(model, opts, true);
    const queryParams = queryBuilder(opts);

    // Allow bookmarks to be used for the watch
    queryParams.allowWatchBookmarks = true;

    // If a name is specified, add it to the query params
    if (opts.name) {
      queryParams.fieldSelector = `metadata.name=${opts.name}`;
    }

    Log.info(`Watching ${path}`, prefix);

    // Create the watcher
    return k.watch(
      path,
      queryParams,
      (phase, payload) => {
        Log.info(`Watch event received for phase ${phase}`, prefix);
        Log.debug(payload, prefix);

        // Perform the callback
        callback(clone(payload), phase as WatchPhase);
      },
      err => {
        Log.error(err, prefix);
        throw err;
      },
    );
  }

  return { subscribe };
};
