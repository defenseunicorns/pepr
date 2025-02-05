// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import { performance } from "perf_hooks";

import { MetricsCollector } from "./metrics";

test("constructor initializes counters correctly", () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  expect(collector).toBeTruthy();
});

test("error method increments error counter", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  collector.error();

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_errors 1/);
});

test("alert method increments alerts counter", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  collector.alert();

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_alerts 1/);
});

test("observeStart returns current timestamp", () => {
  const timeBefore: number = performance.now();
  const startTime: number = MetricsCollector.observeStart();
  const timeAfter: number = performance.now();

  expect(timeBefore <= startTime).toBe(true);
  expect(timeAfter >= startTime).toBe(true);
});

test("observeEnd updates summary", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  const startTime: number = MetricsCollector.observeStart();
  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime);

  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime, "validate");
  collector.observeEnd(startTime, "validate");

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_mutate_count 1/);
  expect(metrics).toMatch(/testPrefix_mutate_sum \d+\.\d+/);

  expect(metrics).toMatch(/testPrefix_validate_count 2/);
  expect(metrics).toMatch(/testPrefix_validate_sum \d+\.\d+/);
});

test("coverage tests, with duplicate counters, default prefix (pepr) and still works properly", async () => {
  const collector: MetricsCollector = new MetricsCollector();
  collector.addCounter("testCounter", "testHelp");
  // second one should log, but still work fine TODO: validate log
  collector.addCounter("testCounter", "testHelp");
  let metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/pepr_testCounter 0/);
  collector.incCounter("testCounter");
  metrics = await collector.getMetrics();
  expect(metrics).toMatch(/pepr_testCounter 1/);
  collector.addSummary("testSummary", "testHelp");
  // second one should log, but still work fine TODO: validate log
  collector.addSummary("testSummary", "testHelp");
  const startTime: number = MetricsCollector.observeStart();

  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime, "testSummary");
  collector.observeEnd(startTime, "testSummary");
  metrics = await collector.getMetrics();
  expect(metrics).toMatch(/pepr_testSummary_count 2/);
  expect(metrics).toMatch(/pepr_testSummary_sum \d+\.\d+/);
});

test("incCacheMiss increments cache miss gauge", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  collector.incCacheMiss("window1");

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_cache_miss{window="window1"} 1/);
});

test("incRetryCount increments retry count gauge", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  collector.incRetryCount(1);

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_resync_failure_count{count="1"} 1/);
});

test("initCacheMissWindow initializes cache miss gauge to zero", async () => {
  const collector: MetricsCollector = new MetricsCollector("testPrefix");

  collector.initCacheMissWindow("window1");

  const metrics: string = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_cache_miss{window="window1"} 0/);
});

test("should initialize cache miss window and maintain size limit", async () => {
  process.env.PEPR_MAX_CACHE_MISS_WINDOWS = "3";
  const collector: MetricsCollector = new MetricsCollector("pepr");
  collector.initCacheMissWindow("window1");
  collector.initCacheMissWindow("window2");
  collector.initCacheMissWindow("window3");
  collector.initCacheMissWindow("window4");

  const metrics: string = await collector.getMetrics();
  expect(metrics).not.toContain("window1");
  expect(metrics).toContain("window4");

  collector.initCacheMissWindow("window5");
  collector.initCacheMissWindow("window6");
  collector.initCacheMissWindow("window7");

  const updatedMetrics: string = await collector.getMetrics();
  expect(updatedMetrics).not.toContain("window4");
  expect(updatedMetrics).toContain("window5");
  expect(updatedMetrics).toContain("window6");
  expect(updatedMetrics).toContain("window7");
});
