// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect } from "@jest/globals";
import * as sut from "./time";

describe("toHuman()", () => {
  it.each([
    // simple
    [1, "1ms"],
    [1000, "1s"],
    [60000, "1m"],
    [3600000, "1h"],
    [86400000, "1d"],
    [604800000, "1w"],
    [2592000000, "1mo"],
    [31536000000, "1y"],

    // combined
    [34822861001, "1y1mo1w1d1h1m1s1ms"],
  ])("given ms '%s', returns '%s' duration", (ms, human) => {
    const result = sut.toHuman(ms);
    expect(result).toBe(human);
  });
});

describe("toMs()", () => {
  it.each([
    // simple
    ["1ms", 1],
    ["1s", 1000],
    ["60s", 60000],
    ["1m", 60000],
    ["60m", 3600000],
    ["1h", 3600000],
    ["24h", 86400000],
    ["1d", 86400000],
    ["7d", 604800000],
    ["1w", 604800000],
    ["30d", 2592000000],
    ["1mo", 2592000000],
    ["365d", 31536000000],
    ["1y", 31536000000],

    // weird
    ["0001s", 1000],
    ["1 s  ", 1000],

    // combined
    ["1y1mo1w1d1h1m1s1ms", 34822861001],
    ["1ms1s1m1h1d1w1mo1y", 34822861001],
  ])("given duration '%s', returns '%s' ms", (human, ms) => {
    const result = sut.toMs(human);
    expect(result).toBe(ms);
  });

  it.each([
    // bad
    ["h1m1s", /Unrecognized number .* while parsing/],
    ["1z", /Unrecognized unit .* while parsing/],
  ])("given duration '%s', throws error matching '%s'", (human, err) => {
    expect(() => sut.toMs(human)).toThrow(err);
  });
});
