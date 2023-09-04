// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";

import { performance } from "perf_hooks";
import { MetricsCollector } from "./metrics";

test("constructor initializes counters correctly", () => {
  const collector = new MetricsCollector("testPrefix");

  expect(collector).toBeTruthy();
});

test("error method increments error counter", async () => {
  const collector = new MetricsCollector("testPrefix");

  collector.error();

  const metrics = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_errors 1/);
});

test("alert method increments alerts counter", async () => {
  const collector = new MetricsCollector("testPrefix");

  collector.alert();

  const metrics = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_alerts 1/);
});

test("observeStart returns current timestamp", () => {
  const collector = new MetricsCollector("testPrefix");

  const timeBefore = performance.now();
  const startTime = collector.observeStart();
  const timeAfter = performance.now();

  expect(timeBefore <= startTime).toBe(true);
  expect(timeAfter >= startTime).toBe(true);
});

test("observeEnd updates summary", async () => {
  const collector = new MetricsCollector("testPrefix");

  const startTime = collector.observeStart();
  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime);

  await new Promise(resolve => setTimeout(resolve, 100)); // Delay to simulate operation
  collector.observeEnd(startTime, "Validate");
  collector.observeEnd(startTime, "Validate");

  const metrics = await collector.getMetrics();
  expect(metrics).toMatch(/testPrefix_Mutate_count 1/);
  expect(metrics).toMatch(/testPrefix_Mutate_sum \d+\.\d+/);

  expect(metrics).toMatch(/testPrefix_Validate_count 2/);
  expect(metrics).toMatch(/testPrefix_Validate_sum \d+\.\d+/);
});
