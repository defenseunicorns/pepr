// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import promClient from "prom-client";
import { performance } from "perf_hooks";

export class MetricsCollector {
  private registery: promClient.Registry;
  private errors: promClient.Counter<string>;
  private alerts: promClient.Counter<string>;
  private summary: promClient.Summary<string>;

  constructor(prefix = "pepr") {
    this.registery = new promClient.Registry();

    this.errors = new promClient.Counter({
      name: `${prefix}_errors`,
      help: "error counter",
      registers: [this.registery],
    });

    this.alerts = new promClient.Counter({
      name: `${prefix}_alerts`,
      help: "alerts counter",
      registers: [this.registery],
    });

    this.summary = new promClient.Summary({
      name: `${prefix}_summary`,
      help: "summary",
      registers: [this.registery],
    });
  }

  error(): void {
    this.errors.inc();
  }

  alert(): void {
    this.alerts.inc();
  }

  observe(startTime: number): void {
    this.summary.observe(performance.now() - startTime);
  }

  async getMetrics(): Promise<string> {
    return this.registery.metrics();
  }
}
