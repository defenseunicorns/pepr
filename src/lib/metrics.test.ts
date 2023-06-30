// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";
import { performance } from "perf_hooks";
import { MetricsCollector } from "./metrics";

test("constructor initializes counters correctly", t => {
  const collector = new MetricsCollector("testPrefix");

  t.truthy(collector);
});

test("error method increments error counter", async t => {
  const collector = new MetricsCollector("testPrefix");

  collector.error();

  const metrics = await collector.getMetrics();
  t.regex(metrics, /testPrefix_errors 1/);
});

test("alert method increments alerts counter", async t => {
  const collector = new MetricsCollector("testPrefix");

  collector.alert();

  const metrics = await collector.getMetrics();
  t.regex(metrics, /testPrefix_alerts 1/);
});

test("observeStart returns current timestamp", t => {
  const collector = new MetricsCollector("testPrefix");

  const timeBefore = performance.now();
  const startTime = collector.observeStart();
  const timeAfter = performance.now();

  t.true(timeBefore <= startTime);
  t.true(timeAfter >= startTime);
});

test("observeEnd updates summary", async t => {
  const collector = new MetricsCollector("testPrefix");

  const startTime = collector.observeStart();
  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime);

  const metrics = await collector.getMetrics();
  t.regex(metrics, /testPrefix_summary_count 1/);
  t.regex(metrics, /testPrefix_summary_sum \d+\.\d+/);
});
