// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Shared constants for the soak test scripts (soak-test.ts, soak-summary.ts, soak-record-metrics.ts).

/** Milliseconds between iterations (5 minutes). */
export const INTERVAL_MS = 300_000;

/** Minutes between iterations. */
export const INTERVAL_MINUTES = INTERVAL_MS / 60_000;

/** Total number of iterations (~350 minutes / ~5 hours 50 minutes). */
export const TOTAL_ITERATIONS = 70;

/** Total run time in milliseconds. */
export const TOTAL_DURATION_MS = TOTAL_ITERATIONS * INTERVAL_MS;

/** Iterations before asserting cache miss growth (~70 minutes). */
export const STABILIZATION_ITERATIONS = 14;

/** Check pod stability every N iterations (every 10 minutes). */
export const POD_CHECK_INTERVAL = 2;

/** Timeout for kubectl commands in milliseconds (2 minutes). */
export const KUBECTL_TIMEOUT_MS = 120_000;

/**
 * Parse a numeric environment variable, returning the default when the variable
 * is unset or not a number. Unlike `Number(x) || default`, this correctly
 * respects an explicit `0` value.
 */
export function parseEnvNumber(envVar: string | undefined, defaultValue: number): number {
  if (envVar === undefined || envVar === "") return defaultValue;
  const parsed = Number(envVar);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
