// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { performance } from "perf_hooks";
import promClient, { Counter, Registry, Gauge, Summary } from "prom-client";
import Log from "./logger";

const loggingPrefix = "MetricsCollector";

type MetricsCollectorInstance = InstanceType<typeof MetricsCollector>;
interface MetricNames {
  errors: string;
  alerts: string;
  mutate: string;
  validate: string;
  cacheMiss: string;
  resyncFailureCount: string;
}

interface MetricArgs {
  name: string;
  help: string;
  registers: Registry[];
  labelNames?: string[];
}

/**
 * MetricsCollector class handles metrics collection using prom-client and performance hooks.
 */
export class MetricsCollector {
  #registry: Registry;
  #counters: Map<string, Counter<string>> = new Map();
  #gauges: Map<string, Gauge<string>> = new Map();
  #summaries: Map<string, Summary<string>> = new Map();
  #prefix: string;
  #cacheMissWindows: Map<string, number> = new Map();

  #metricNames: MetricNames = {
    errors: "errors",
    alerts: "alerts",
    mutate: "mutate",
    validate: "validate",
    cacheMiss: "cache_miss",
    resyncFailureCount: "resync_failure_count",
  };

  /**
   * Creates a MetricsCollector instance with prefixed metrics.
   * @param [prefix='pepr'] - The prefix for the metric names.
   */
  constructor(prefix = "pepr") {
    this.#registry = new Registry();
    this.#prefix = prefix;
    this.addCounter(this.#metricNames.errors, "Mutation/Validate errors encountered");
    this.addCounter(this.#metricNames.alerts, "Mutation/Validate bad api token received");
    this.addSummary(this.#metricNames.mutate, "Mutation operation summary");
    this.addSummary(this.#metricNames.validate, "Validation operation summary");
    this.addGauge(this.#metricNames.cacheMiss, "Number of cache misses per window", ["window"]);
    this.addGauge(this.#metricNames.resyncFailureCount, "Number of failures per resync operation", ["count"]);
  }

  #getMetricName = (name: string): string => `${this.#prefix}_${name}`;

  #addMetric = <T extends Counter<string> | Gauge<string> | Summary<string>>(
    collection: Map<string, T>,
    MetricType: new (args: MetricArgs) => T,
    name: string,
    help: string,
    labelNames?: string[],
  ): void => {
    if (collection.has(this.#getMetricName(name))) {
      Log.debug(`Metric for ${name} already exists`, loggingPrefix);
      return;
    }

    const metric = new MetricType({
      name: this.#getMetricName(name),
      help,
      registers: [this.#registry],
      labelNames,
    });

    collection.set(this.#getMetricName(name), metric);
  };

  addCounter = (name: string, help: string): void => {
    this.#addMetric(this.#counters, promClient.Counter, name, help, []);
  };

  addSummary = (name: string, help: string): void => {
    this.#addMetric(this.#summaries, promClient.Summary, name, help, []);
  };

  addGauge = (name: string, help: string, labelNames?: string[]): void => {
    this.#addMetric(this.#gauges, promClient.Gauge, name, help, labelNames);
  };

  incCounter = (name: string): void => {
    this.#counters.get(this.#getMetricName(name))?.inc();
  };

  incGauge = (name: string, labels?: Record<string, string>, value: number = 1): void => {
    this.#gauges.get(this.#getMetricName(name))?.inc(labels || {}, value);
  };

  /**
   * Increments the error counter.
   */
  error = (): void => this.incCounter(this.#metricNames.errors);

  /**
   * Increments the alerts counter.
   */
  alert = (): void => this.incCounter(this.#metricNames.alerts);

  /**
   * Observes the duration since the provided start time and updates the summary.
   * @param startTime - The start time.
   * @param name - The metrics summary to increment.
   */
  observeEnd = (startTime: number, name: string = this.#metricNames.mutate): void => {
    this.#summaries.get(this.#getMetricName(name))?.observe(performance.now() - startTime);
  };

  /**
   * Fetches the current metrics from the registry.
   * @returns The metrics.
   */
  getMetrics = (): Promise<string> => this.#registry.metrics();

  /**
   * Returns the current timestamp from performance.now() method. Useful for start timing an operation.
   * @returns The timestamp.
   */
  static observeStart(): number {
    return performance.now();
  }

  /**
   * Increments the cache miss gauge for a given label.
   * @param label - The label for the cache miss.
   */
  incCacheMiss = (window: string): void => {
    this.incGauge(this.#metricNames.cacheMiss, { window });
  };

  /**
   * Increments the retry count gauge.
   * @param count - The count to increment by.
   */
  incRetryCount = (count: string): void => {
    this.incGauge(this.#metricNames.resyncFailureCount, { count });
  };

  /**
   * Initializes the cache miss gauge for a given label.
   * @param label - The label for the cache miss.
   */
  initCacheMissWindow = (window: string): void => {
    this.#rollCacheMissWindows();
    this.#gauges.get(this.#getMetricName(this.#metricNames.cacheMiss))?.set({ window }, 0);
    this.#cacheMissWindows.set(window, 0);
  };

  /**
   * Manages the size of the cache miss gauge map.
   */
  #rollCacheMissWindows = (): void => {
    const maxCacheMissWindows = process.env.PEPR_MAX_CACHE_MISS_WINDOWS
      ? parseInt(process.env.PEPR_MAX_CACHE_MISS_WINDOWS, 10)
      : undefined;

    if (maxCacheMissWindows !== undefined && this.#cacheMissWindows.size >= maxCacheMissWindows) {
      const firstKey = this.#cacheMissWindows.keys().next().value;
      if (firstKey !== undefined) {
        this.#cacheMissWindows.delete(firstKey);
      }
      this.#gauges.get(this.#getMetricName(this.#metricNames.cacheMiss))?.remove({ window: firstKey });
    }
  };
}

export const metricsCollector: MetricsCollectorInstance = new MetricsCollector("pepr");
