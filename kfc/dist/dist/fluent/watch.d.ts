import { EventEmitter } from "events";
import { GenericClass } from "../types";
import { Filters, WatchAction } from "./types";
export declare enum WatchEvent {
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
    INIT_CACHE_MISS = "init_cache_miss"
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
/** A wrapper around the Kubernetes watch API. */
export declare class Watcher<T extends GenericClass> {
    #private;
    $relistTimer?: NodeJS.Timeout;
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
    constructor(model: T, filters: Filters, callback: WatchAction<T>, watchCfg?: WatchCfg);
    /**
     * Start the watch.
     *
     * @returns The AbortController for the watch.
     */
    start(): Promise<AbortController>;
    /** Close the watch. Also available on the AbortController returned by {@link Watcher.start}. */
    close(): void;
    /**
     * Get a unique ID for the watch based on the model and filters.
     * This is useful for caching the watch data or resource versions.
     *
     * @returns the watch CacheID
     */
    getCacheID(): string;
    /**
     * Subscribe to watch events. This is an EventEmitter that emits the following events:
     *
     * Use {@link WatchEvent} for the event names.
     *
     * @returns an EventEmitter
     */
    get events(): EventEmitter;
}
//# sourceMappingURL=watch.d.ts.map