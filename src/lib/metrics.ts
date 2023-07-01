// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import promClient from "prom-client";
import { performance } from "perf_hooks";

/**
 * MetricsCollector class handles metrics collection using prom-client and performance hooks.
 */
export class MetricsCollector {
  private _registry: promClient.Registry;
  private _errors: promClient.Counter<string>;
  private _alerts: promClient.Counter<string>;
  private _summary: promClient.Summary<string>;

  /**
   * Creates a MetricsCollector instance with prefixed metrics.
   * @param {string} [prefix='pepr'] - The prefix for the metric names.
   */
  constructor(prefix = "pepr") {
    this._registry = new promClient.Registry();

    this._errors = new promClient.Counter({
      name: `${prefix}_errors`,
      help: "error counter",
      registers: [this._registry],
    });

    this._alerts = new promClient.Counter({
      name: `${prefix}_alerts`,
      help: "alerts counter",
      registers: [this._registry],
    });

    this._summary = new promClient.Summary({
      name: `${prefix}_summary`,
      help: "summary",
      registers: [this._registry],
    });
  }

  /**
   * Increments the error counter.
   */
  error() {
    this._errors.inc();
  }

  /**
   * Increments the alerts counter.
   */
  alert() {
    this._alerts.inc();
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
   */
  observeEnd(startTime: number) {
    this._summary.observe(performance.now() - startTime);
  }

  /**
   * Fetches the current metrics from the registry.
   * @returns {Promise<string>} The metrics.
   */
  async getMetrics() {
    return this._registry.metrics();
  }
}
