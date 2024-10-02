// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import byline from "byline";
import { createHash } from "crypto";
import { EventEmitter } from "events";
import https from "https";
import { Agent, fetch } from "undici";
import { fetch as wrappedFetch } from "../fetch";
import { GenericClass, KubernetesListObject } from "../types";
import { Filters, WatchAction, WatchPhase } from "./types";
import { k8sCfg, pathBuilder } from "./utils";
import { Readable } from 'stream';
import fs from 'fs';

export enum WatchEvent {
  /** Watch is connected successfully */
  CONNECT = "connect",
  /** Network error occurs */
  NETWORK_ERROR = "network_error",
  /** Error decoding data or running the callback */
  DATA_ERROR = "data_error",
  /** Reconnect is called */
  RECONNECT = "reconnect",
  /** Retry limit is exceeded */
  GIVE_UP = "give_up",
  /** Abort is called */
  ABORT = "abort",
  /** Data is received and decoded */
  DATA = "data",
  /** 410 (old resource version) occurs */
  OLD_RESOURCE_VERSION = "old_resource_version",
  /** A reconnect is already pending */
  RECONNECT_PENDING = "reconnect_pending",
  /** Resource list operation run */
  LIST = "list",
  /** List operation error */
  LIST_ERROR = "list_error",
  /** Cache Misses */
  CACHE_MISS = "cache_miss",
  /** Increment resync failure count */
  INC_RESYNC_FAILURE_COUNT = "inc_resync_failure_count",
  /** Initialize a relist window */
  INIT_CACHE_MISS = "init_cache_miss",
}

/** Configuration for the watch function. */
export type WatchCfg = {
  /** The maximum number of times to retry the watch, the retry count is reset on success. Unlimited retries if not specified. */
  resyncFailureMax?: number;
  /** Seconds between each resync check. Defaults to 5. */
  resyncDelaySec?: number;
  /** Amount of seconds to wait before relisting the watch list. Defaults to 600 (10 minutes). */
  relistIntervalSec?: number;
  /** Max amount of seconds to go without receiving an event before reconciliation starts. Defaults to 300 (5 minutes). */
  lastSeenLimitSeconds?: number;
};

const NONE = 50;
const OVERRIDE = 100;
const key = fs.readFileSync('/etc/certs/tls.key');
const cert = fs.readFileSync('/etc/certs/tls.crt');
const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token')
/** A wrapper around the Kubernetes watch API. */
export class Watcher<T extends GenericClass> {
  // User-provided properties
  #model: T;
  #filters: Filters;
  #callback: WatchAction<T>;
  #watchCfg: WatchCfg;
  #latestRelistWindow: string = "";

  // Track the last time data was received
  #lastSeenTime = NONE;
  #lastSeenLimit: number;

  // Create a wrapped AbortController to allow the watch to be aborted externally
  #abortController: AbortController;

  // Track the number of retries
  #resyncFailureCount = 0;

  // Create a stream to read the response body
  #stream?: byline.LineStream;

  // Create an EventEmitter to emit events
  #events = new EventEmitter();

  // Create a timer to relist the watch
  $relistTimer?: NodeJS.Timeout;

  // Create a timer to resync the watch
  #resyncTimer?: NodeJS.Timeout;

  // Track if a reconnect is pending
  #pendingReconnect = false;

  // The resource version to start the watch at, this will be updated after the list operation.
  #resourceVersion?: string;

  // Track the list of items in the cache
  #cache = new Map<string, InstanceType<T>>();

  /**
   * Setup a Kubernetes watcher for the specified model and filters. The callback function will be called for each event received.
   * The watch can be aborted by calling {@link Watcher.close} or by calling abort() on the AbortController returned by {@link Watcher.start}.
   *
   *
   * Kubernetes API docs: {@link https://kubernetes.io/docs/reference/using-api/api-concepts/#efficient-detection-of-changes}
   *
   * @param model - the model to use for the API
   * @param filters - (optional) filter overrides, can also be chained
   * @param callback - the callback function to call when an event is received
   * @param watchCfg - (optional) watch configuration
   */
  constructor(model: T, filters: Filters, callback: WatchAction<T>, watchCfg: WatchCfg = {}) {
    // Set the retry delay to 5 seconds if not specified
    watchCfg.resyncDelaySec ??= 5;

    // Set the relist interval to 10 minutes if not specified
    watchCfg.relistIntervalSec ??= 600;

    // Set the resync interval to 10 minutes if not specified
    watchCfg.lastSeenLimitSeconds ??= 600;

    // eliminate this
    watchCfg.resyncFailureMax = undefined;

    // Set the last seen limit to the resync interval
    this.#lastSeenLimit = watchCfg.lastSeenLimitSeconds * 1000;

    // Set the latest relist interval to now
    this.#latestRelistWindow = new Date().toISOString();

    // Add random jitter to the relist/resync intervals (up to 1 second)
    const jitter = Math.floor(Math.random() * 1000);

    // Check every relist interval for cache staleness
    this.$relistTimer = setInterval(
      () => {
        this.#latestRelistWindow = new Date().toISOString();
        this.#events.emit(WatchEvent.INIT_CACHE_MISS, this.#latestRelistWindow);
        void this.#list();
      },
      watchCfg.relistIntervalSec * 1000 + jitter,
    );

    // Rebuild the watch every resync delay interval
    this.#resyncTimer = setInterval(this.#checkResync, watchCfg.resyncDelaySec * 1000 + jitter);

    // Bind class properties
    this.#model = model;
    this.#filters = filters;
    this.#callback = callback;
    this.#watchCfg = watchCfg;

    // Create a new AbortController
    this.#abortController = new AbortController();
  }

  /**
   * Start the watch.
   *
   * @returns The AbortController for the watch.
   */
  public async start(): Promise<AbortController> {
    this.#events.emit(WatchEvent.INIT_CACHE_MISS, this.#latestRelistWindow);
    await this.#watch();
    return this.#abortController;
  }

  /** Close the watch. Also available on the AbortController returned by {@link Watcher.start}. */
  public close() {
    clearInterval(this.$relistTimer);
    clearInterval(this.#resyncTimer);
    this.#streamCleanup();
    this.#abortController.abort();
  }

  /**
   * Get a unique ID for the watch based on the model and filters.
   * This is useful for caching the watch data or resource versions.
   *
   * @returns the watch CacheID
   */
  public getCacheID() {
    // Build the URL, we don't care about the server URL or resourceVersion
    const url = pathBuilder("https://ignore", this.#model, this.#filters, false);

    // Hash and truncate the ID to 10 characters, cache the result
    return createHash("sha224")
      .update(url.pathname + url.search)
      .digest("hex")
      .substring(0, 10);
  }

  /**
   * Subscribe to watch events. This is an EventEmitter that emits the following events:
   *
   * Use {@link WatchEvent} for the event names.
   *
   * @returns an EventEmitter
   */
  public get events(): EventEmitter {
    return this.#events;
  }

  /**
   * Build the URL and request options for the watch.
   *
   * @param isWatch - whether the request is for a watch operation
   * @param resourceVersion - the resource version to use for the watch
   * @param continueToken - the continue token for the watch
   *
   * @returns the URL and request options
   */
  #buildURL = async (isWatch: boolean, resourceVersion?: string, continueToken?: string) => {
    // Build the path and query params for the resource, excluding the name
    const { opts, serverUrl } = await k8sCfg("GET");

    const url = pathBuilder(serverUrl, this.#model, this.#filters, true);

    // Enable the watch query param
    if (isWatch) {
      url.searchParams.set("watch", "true");
    }

    if (continueToken) {
      url.searchParams.set("continue", continueToken);
    }

    // If a name is specified, add it to the query params
    if (this.#filters.name) {
      url.searchParams.set("fieldSelector", `metadata.name=${this.#filters.name}`);
    }

    // If a resource version is specified, add it to the query params
    if (resourceVersion) {
      url.searchParams.set("resourceVersion", resourceVersion);
    }

    // Add the abort signal to the request options
    opts.signal = this.#abortController.signal;

    return { opts, url };
  };

  /**
   * Retrieve the list of resources and process the events.
   *
   * @param continueToken - the continue token for the list
   * @param removedItems - the list of items that have been removed
   */
  #list = async (continueToken?: string, removedItems?: Map<string, InstanceType<T>>) => {
    try {
      const { opts, url } = await this.#buildURL(false, undefined, continueToken);

      // Make the request to list the resources
      const response = await wrappedFetch<KubernetesListObject<InstanceType<T>>>(url, opts);
      const list = response.data;

      // If the request fails, emit an error event and return
      if (!response.ok) {
        this.#events.emit(
          WatchEvent.LIST_ERROR,
          new Error(`list failed: ${response.status} ${response.statusText}`),
        );

        return;
      }

      // Gross hack, thanks upstream library :<
      if ((list.metadata as { continue?: string }).continue) {
        continueToken = (list.metadata as { continue?: string }).continue;
      }

      // Emit the list event
      this.#events.emit(WatchEvent.LIST, list);

      // Update the resource version from the list metadata
      this.#resourceVersion = list.metadata?.resourceVersion;

      // If removed items are not provided, clone the cache
      removedItems = removedItems || new Map(this.#cache.entries());

      // Process each item in the list
      for (const item of list.items || []) {
        const { uid } = item.metadata;

        // Remove the item from the removed items list
        const alreadyExists = removedItems.delete(uid);

        // If the item does not exist, it is new and should be added
        if (!alreadyExists) {
          this.#events.emit(WatchEvent.CACHE_MISS, this.#latestRelistWindow);
          // Send added event. Use void here because we don't care about the result (no consequences here if it fails)
          void this.#process(item, WatchPhase.Added);
          continue;
        }

        // Check if the resource version has changed for items that already exist
        const cachedRV = parseInt(this.#cache.get(uid)?.metadata?.resourceVersion);
        const itemRV = parseInt(item.metadata.resourceVersion);

        // Check if the resource version is newer than the cached version
        if (itemRV > cachedRV) {
          this.#events.emit(WatchEvent.CACHE_MISS, this.#latestRelistWindow);
          // Send a modified event if the resource version has changed
          void this.#process(item, WatchPhase.Modified);
        }
      }

      // If there is a continue token, call the list function again with the same removed items
      if (continueToken) {
        // If there is a continue token, call the list function again with the same removed items
        // @todo: using all voids here is important for freshness, but is naive with regard to API load & pod resources
        await this.#list(continueToken, removedItems);
      } else {
        // Otherwise, process the removed items
        for (const item of removedItems.values()) {
          this.#events.emit(WatchEvent.CACHE_MISS, this.#latestRelistWindow);
          void this.#process(item, WatchPhase.Deleted);
        }
      }
    } catch (err) {
      this.#events.emit(WatchEvent.LIST_ERROR, err);
    }
  };

  /**
   * Process the event payload.
   *
   * @param payload - the event payload
   * @param phase - the event phase
   */
  #process = async (payload: InstanceType<T>, phase: WatchPhase) => {
    try {
      switch (phase) {
        // If the event is added or modified, update the cache
        case WatchPhase.Added:
        case WatchPhase.Modified:
          this.#cache.set(payload.metadata.uid, payload);
          break;

        // If the event is deleted, remove the item from the cache
        case WatchPhase.Deleted:
          this.#cache.delete(payload.metadata.uid);
          break;
      }

      // Emit the data event
      this.#events.emit(WatchEvent.DATA, payload, phase);

      // Call the callback function with the parsed payload
      await this.#callback(payload, phase);
    } catch (err) {
      this.#events.emit(WatchEvent.DATA_ERROR, err);
    }
  };

  /**
   * Watch for changes to the resource.
   */
  #watch = async () => {
    try {
      // Start with a list operation
      await this.#list();

      // Build the URL and request options
      const { opts, url } = await this.#buildURL(true, this.#resourceVersion);
      let agentOptions;
      if (opts.agent && opts.agent instanceof https.Agent) {
        agentOptions = {
          key: opts.agent.options.key,
          cert: opts.agent.options.cert,
          ca: opts.agent.options.ca,
          // key,
          // cert,
          rejectUnauthorized: false,
        };
      }
      // Cert and Key are coming back undefined
      console.log("Agent Options", {ca: agentOptions?.ca, cert: agentOptions?.cert, key: agentOptions?.key})

      const agent = new Agent({
        // https://github.com/nodejs/undici/blob/87d7ccf6b51c61a4f4a056f7c2cac78347618486/docs/docs/api/Errors.md?plain=1#L16
        // https://github.com/nodejs/undici/blob/87d7ccf6b51c61a4f4a056f7c2cac78347618486/docs/docs/api/Client.md?plain=1#L24
        keepAliveMaxTimeout: 600000,
        keepAliveTimeout: 600000,
        bodyTimeout: 600000, // 0 to disable entirely
        connect: {
          ca: agentOptions?.ca,
          cert: agentOptions?.cert,
          key: agentOptions?.key
        },
      })
      // Perform the fetch call with the proper HTTPS agent
      let response;
      try {
        response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": `kubernetes-fluent-client`,
            "Authorization": `Bearer ${token}`
          },
          dispatcher: agent
        });
      } catch (err) {
        console.error("Error during fetch:", err);
        console.log("Agent ", agent)
        await this.#reconnect(); 
        return;
      }

      // Reset the pending reconnect flag
      this.#pendingReconnect = false;

      // If the request is successful, start listening for events
      if (response.ok) {
        this.#events.emit(WatchEvent.CONNECT, url.pathname);

        const { body } = response;

        if (!body) {
          throw new Error("No response body found");
        }

        // Reset the retry count
        this.#resyncFailureCount = 0;
        this.#events.emit(WatchEvent.INC_RESYNC_FAILURE_COUNT, this.#resyncFailureCount);

        // Use a native stream issue #1180
        const stream = Readable.from(body)
        const decoder = new TextDecoder();
        let buffer = "";

        stream.on('data', (chunk) => {
          try {
            // Decode chunk using TextDecoder
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            // Keep last incomplete line in the buffer for the next chunk
            buffer = lines.pop()!;
  
            for (const line of lines) {
              try {
                // Parse the event payload
                const { object: payload, type: phase } = JSON.parse(line) as {
                  type: WatchPhase;
                  object: InstanceType<T>;
                };
  
                // Update the last seen time
                this.#lastSeenTime = Date.now();
  
                // If the watch is too old, remove the resourceVersion and reload the watch
                if (phase === WatchPhase.Error && payload.code === 410) {
                  throw {
                    name: "TooOld",
                    message: this.#resourceVersion!,
                  };
                }
  
                // Process the event payload, do not update the resource version as that is handled by the list operation
                void this.#process(payload, phase);
              } catch (err) {
                if (err.name === "TooOld") {
                  // Reload the watch
                  void this.#errHandler(err);
                  return;
                }
  
                this.#events.emit(WatchEvent.DATA_ERROR, err);
              }
            }
          } catch (err) {
            console.error("Error processing stream data:", err);
          }
        });
  
        stream.on('close', () => {
          console.log('Stream closed, attempting reconnection...');
          this.#streamCleanup();
          void this.#reconnect();
        });
  
        stream.on('end', () => {
          console.log('Stream ended gracefully, reconnecting...');
          this.#streamCleanup();
          void this.#reconnect();
        });
  
        stream.on('error', (err) => {
          console.error('Stream error:', err);
          this.#streamCleanup();
          void this.#reconnect();
        });
  
        stream.on('finish', () => {
          console.log('Stream finished.');
          this.#streamCleanup();
          void this.#reconnect();
        });
  
      } else {
        throw new Error(`watch connect failed: ${response.status} ${response.statusText}`);
      }
    } catch (e) {
      console.error("Watch function error:", e);
      void this.#errHandler(e);
    }
  };
  

  // Function to handle reconnecting
  #reconnect = async () => {
    try {
      this.#streamCleanup();
      console.log("Retrying watch");
      await this.#watch();
    } catch (err) {
      console.error("Retrying failed:", err);
      this.#events.emit(WatchEvent.GIVE_UP, err);
    }
  };

  /** Clear the resync timer and schedule a new one. */
  #checkResync = () => {
    // Ignore if the last seen time is not set
    if (this.#lastSeenTime === NONE) {
      return;
    }

    const now = Date.now();

    // If the last seen time is greater than the limit, trigger a resync
    if (this.#lastSeenTime == OVERRIDE || now - this.#lastSeenTime > this.#lastSeenLimit) {
      // Reset the last seen time to now to allow the resync to be called again in case of failure
      this.#lastSeenTime = now;

      // If there are more attempts, retry the watch (undefined is unlimited retries)
      if (
        this.#watchCfg.resyncFailureMax === undefined ||
        this.#watchCfg.resyncFailureMax > this.#resyncFailureCount
      ) {
        // Increment the retry count
        this.#resyncFailureCount++;
        this.#events.emit(WatchEvent.INC_RESYNC_FAILURE_COUNT, this.#resyncFailureCount);

        if (this.#pendingReconnect) {
          // wait for the connection to be re-established
          this.#events.emit(WatchEvent.RECONNECT_PENDING);
        } else {
          this.#pendingReconnect = true;
          this.#events.emit(WatchEvent.RECONNECT, this.#resyncFailureCount);
          this.#streamCleanup();

          void this.#watch();
        }
      } else {
        // Otherwise, call the finally function if it exists
        this.#events.emit(
          WatchEvent.GIVE_UP,
          new Error(`Retry limit (${this.#watchCfg.resyncFailureMax}) exceeded, giving up`),
        );
        this.close();
      }
    }
  };

  /**
   * Handle errors from the stream.
   *
   * @param err - the error that occurred
   */
  #errHandler = async (err: Error) => {
    switch (err.name) {
      case "AbortError":
        clearInterval(this.$relistTimer);
        clearInterval(this.#resyncTimer);
        this.#streamCleanup();
        this.#events.emit(WatchEvent.ABORT, err);
        return;

      case "TooOld":
        // Purge the resource version if it is too old
        this.#resourceVersion = undefined;
        this.#events.emit(WatchEvent.OLD_RESOURCE_VERSION, err.message);
        break;

      default:
        this.#events.emit(WatchEvent.NETWORK_ERROR, err);
        break;
    }

    // Force a resync
    this.#lastSeenTime = OVERRIDE;
  };

  /** Cleanup the stream and listeners. */
  #streamCleanup = () => {
    if (this.#stream) {
      this.#stream.removeAllListeners();
      this.#stream.destroy();
    }
  };
}
