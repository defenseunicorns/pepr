// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";
import readline from "readline";

import { fetchRaw } from "../../fetch";
import Log from "../../logger";
import { GenericClass, WatchAction, WatchPhase } from "../../types";
import { Filters } from "./types";
import { kubeCfg, pathBuilder } from "./utils";

/**
 * Watch Kubernetes resources from every Pepr Controller pod simultaneously.
 *
 *
 * ⚠️ WARNING ⚠️
 *
 * This watch will run on every Pepr Controller pod at the same time and
 * you should typically use the Pepr Watch Action instead unless you
 * really need the watch to run on every controller pod simultaneously.
 */
export async function ExecWatch<T extends GenericClass>(model: T, filters: Filters, callback: WatchAction<T>) {
  // Build the path and query params for the resource, excluding the name
  const { opts, serverUrl } = await kubeCfg("GET");
  const url = pathBuilder(serverUrl, model, filters, true);

  // Enable the watch query param
  url.searchParams.set("watch", "true");

  // Allow bookmarks to be used for the watch
  url.searchParams.set("allowWatchBookmarks", "true");

  // If a name is specified, add it to the query params
  if (filters.name) {
    url.searchParams.set("fieldSelector", `metadata.name=${filters.name}`);
  }

  const prefix = `Watch ${url.pathname}`;

  // Add abort controller to the long-running request
  const controller = new AbortController();
  opts.signal = controller.signal;

  // Close the connection and make the callback function no-op
  let close = (err?: Error) => {
    if (err) {
      Log.error(err, prefix);
    }
    controller.abort();
    close = () => {};
  };

  try {
    // Make the actual request
    const response = await fetchRaw(url, opts);

    // If the request is successful, start listening for events
    if (response.ok) {
      const { body } = response;

      // Bind connection events to the close function
      body.on("error", close);
      body.on("close", close);
      body.on("finish", close);

      // Create a readline interface to parse the stream
      const rl = readline.createInterface({
        input: response.body!,
        terminal: false,
      });

      // Listen for events and call the callback function
      rl.on("line", line => {
        try {
          // Parse the event payload
          const { object: payload, type: phase } = JSON.parse(line) as { type: WatchPhase; object: InstanceType<T> };

          Log.info(`Watch event received for phase ${phase}`, prefix);
          Log.debug(payload, prefix);

          // Call the callback function with the parsed payload
          void callback(clone(payload), phase as WatchPhase);
        } catch (ignore) {
          // ignore parse errors
        }
      });
    } else {
      // If the request fails, throw an error
      const error = new Error(response.statusText) as Error & {
        statusCode: number | undefined;
      };
      error.statusCode = response.status;
      throw error;
    }
  } catch (e) {
    close(e);
  }

  return controller;
}
