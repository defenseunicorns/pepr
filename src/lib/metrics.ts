// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import promClient, { Counter, Summary, Registry } from "prom-client";
import { performance } from "perf_hooks";
import Log from "./logger";

const loggingPrefix = "MetricsCollector";

interface MetricNames {
  errors: string;
  alerts: string;
  mutate: string;
  validate: string;
}

interface MetricArgs {
  name: string;
  help: string;
  registers: Registry[];
}

/**
 * MetricsCollector class handles metrics collection using prom-client and performance hooks.
 */
export class MetricsCollector {
  private _registry: Registry;
  private _counters: Map<string, Counter<string>> = new Map();
  private _summaries: Map<string, Summary<string>> = new Map();
  private _prefix: string;

  private _metricNames: MetricNames = {
    errors: "errors",
    alerts: "alerts",
    mutate: "Mutate",
    validate: "Validate",
  };

  /**
   * Creates a MetricsCollector instance with prefixed metrics.
   * @param prefix - The prefix for the metric names.
   */
  constructor(prefix = "pepr") {
    this._registry = new Registry();
    this._prefix = prefix;
    this.addCounter(this._metricNames.errors, "Mutation/Validate errors encountered");
    this.addCounter(this._metricNames.alerts, "Mutation/Validate bad api token received");
    this.addSummary(this._metricNames.mutate, "Mutation operation summary");
    this.addSummary(this._metricNames.validate, "Validation operation summary");
  }
  private getMetricName(name: string) {
    return `${this._prefix}_${name}`;
  }

  private addMetric<T extends Counter<string> | Summary<string>>(
    collection: Map<string, T>,
    MetricType: new (args: MetricArgs) => T,
    name: string,
    help: string,
  ) {
    if (collection.has(this.getMetricName(name))) {
      Log.debug(`Metric for ${name} already exists`, loggingPrefix);
      return;
    }
    const metric = new MetricType({
      name: this.getMetricName(name),
      help,
      registers: [this._registry],
    });
    collection.set(this.getMetricName(name), metric);
  }

  addCounter(name: string, help: string) {
    this.addMetric(this._counters, promClient.Counter, name, help);
  }

  addSummary(name: string, help: string) {
    this.addMetric(this._summaries, promClient.Summary, name, help);
  }

  incCounter(name: string) {
    this._counters.get(this.getMetricName(name))?.inc();
  }

  /**
   * Increments the error counter.
   */
  error() {
    this.incCounter(this._metricNames.errors);
  }

  /**
   * Increments the alerts counter.
   */
  alert() {
    this.incCounter(this._metricNames.alerts);
  }

  /**
   * Returns the current timestamp from performance.now() method. Useful for start timing an operation.
   * @returns {number} The timestamp.
   */
  observeStart() {
    return performance.now();
  }

  /**
   * Observes the duration since the provided start time and updates the summary.
   * @param {number} startTime - The start time.
   * @param {string} name - The metrics summary to increment.
   */
  observeEnd(startTime: number, name: string = this._metricNames.mutate) {
    this._summaries.get(this.getMetricName(name))?.observe(performance.now() - startTime);
  }

  /**
   * Fetches the current metrics from the registry.
   * @returns {Promise<string>} The metrics.
   */
  async getMetrics() {
    return this._registry.metrics();
  }
}
