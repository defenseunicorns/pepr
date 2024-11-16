// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect } from "@jest/globals";
import { heredoc } from "../src/sdk/heredoc";
import * as sut from "./load.lib";

describe("toHuman", () => {
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

describe("toMs", () => {
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

describe("generateAudienceData()", () => {
  it("creates 'random' datasets", () => {
    let numSamples = 2;
    let result = sut.generateAudienceData("random", numSamples);

    let numRows = numSamples * 3; // 2 admission & 1 watch pods
    expect(result).toHaveLength(numRows);
  });

  // it.skip("creates 'increasing' datasets", () => {});
  // it.skip("creates 'decreasing' datasets", () => {});
});

describe("parseActressData", () => {
  let actressData = heredoc`
    ---\\\\napiVersion: v1\\\\nkind: ConfigMap\\\\nmetadata:\\\\n  namespace: hello-pepr-load\\\\n  name: cm-UNIQUIFY-ME\\\\n  labels:\\\\n    test-transient: hello-pepr-load\\\\ndata: {}\\\\n
    1731682427803	configmap/cm-1731682427524-0 created
    1731682428102	configmap/cm-1731682427805-1 created
    1731682428365	configmap/cm-1731682428103-2 created
    1731682428668	configmap/cm-1731682428366-3 created
    1731682428978	configmap/cm-1731682428669-4 created
    1731682429300	configmap/cm-1731682428979-5 created
  `;
  actressData += "\n";

  it("converts logged data appropriately split lines", () => {
    let expected = {
      load: `---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  namespace: hello-pepr-load\n  name: cm-UNIQUIFY-ME\n  labels:\n    test-transient: hello-pepr-load\ndata: {}\n`,
      injects: [
        1731682427803, 1731682428102, 1731682428365, 1731682428668, 1731682428978, 1731682429300,
      ],
    };

    let result = sut.parseActressData(actressData);

    expect(result).toEqual(expected);
  });
});

describe("parseAudienceData", () => {
  let audienceData = heredoc`
    1731525754189	pepr-pepr-load-aaaa0bbbb-aaaaa           2m    102Mi   
    1731525754189	pepr-pepr-load-aaaa0bbbb-bbbbb           3m    103Mi   
    1731525754189	pepr-pepr-load-watcher-ccccccccc-ccccc   23m   123Mi   
    1731525814222	pepr-pepr-load-aaaa0bbbb-aaaaa           4m    104Mi   
    1731525814222	pepr-pepr-load-aaaa0bbbb-bbbbb           5m    105Mi   
    1731525814222	pepr-pepr-load-watcher-ccccccccc-ccccc   45m   145Mi   
  `;
  audienceData += "\n";

  it("converts logged data into per-pod datasets", () => {
    let expected = {
      "pepr-pepr-load-aaaa0bbbb-aaaaa": [
        [1731525754189, 2, "m", 106954752, "B"],
        [1731525814222, 4, "m", 109051904, "B"],
      ],
      "pepr-pepr-load-aaaa0bbbb-bbbbb": [
        [1731525754189, 3, "m", 108003328, "B"],
        [1731525814222, 5, "m", 110100480, "B"],
      ],
      "pepr-pepr-load-watcher-ccccccccc-ccccc": [
        [1731525754189, 23, "m", 128974848, "B"],
        [1731525814222, 45, "m", 152043520, "B"],
      ],
    };

    let result = sut.parseAudienceData(audienceData);

    expect(result).toEqual(expected);
  });
});
