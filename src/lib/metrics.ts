// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/* eslint-disable class-methods-use-this */

import { performance } from "perf_hooks";
import promClient, { Counter, Registry, Summary } from "prom-client";
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
  #registry: Registry;
  #counters: Map<string, Counter<string>> = new Map();
  #summaries: Map<string, Summary<string>> = new Map();
  #prefix: string;

  #metricNames: MetricNames = {
    errors: "errors",
    alerts: "alerts",
    mutate: "Mutate",
    validate: "Validate",
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
  }

  #getMetricName = (name: string) => `${this.#prefix}_${name}`;

  #addMetric = <T extends Counter<string> | Summary<string>>(
    collection: Map<string, T>,
    MetricType: new (args: MetricArgs) => T,
    name: string,
    help: string,
  ) => {
    if (collection.has(this.#getMetricName(name))) {
      Log.debug(`Metric for ${name} already exists`, loggingPrefix);
      return;
    }

    const metric = new MetricType({
      name: this.#getMetricName(name),
      help,
      registers: [this.#registry],
    });

    collection.set(this.#getMetricName(name), metric);
  };

  addCounter = (name: string, help: string) => {
    this.#addMetric(this.#counters, promClient.Counter, name, help);
  };

  addSummary = (name: string, help: string) => {
    this.#addMetric(this.#summaries, promClient.Summary, name, help);
  };

  incCounter = (name: string) => {
    this.#counters.get(this.#getMetricName(name))?.inc();
  };

  /**
   * Increments the error counter.
   */
  error = () => this.incCounter(this.#metricNames.errors);

  /**
   * Increments the alerts counter.
   */
  alert = () => this.incCounter(this.#metricNames.alerts);

  /**
   * Observes the duration since the provided start time and updates the summary.
   * @param startTime - The start time.
   * @param name - The metrics summary to increment.
   */
  observeEnd = (startTime: number, name: string = this.#metricNames.mutate) => {
    this.#summaries.get(this.#getMetricName(name))?.observe(performance.now() - startTime);
  };

  /**
   * Fetches the current metrics from the registry.
   * @returns The metrics.
   */
  getMetrics = () => this.#registry.metrics();

  /**
   * Returns the current timestamp from performance.now() method. Useful for start timing an operation.
   * @returns The timestamp.
   */
  static observeStart() {
    return performance.now();
  }
}
