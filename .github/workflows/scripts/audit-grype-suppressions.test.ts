// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect } from "vitest";
import { dump, load } from "js-yaml";

import {
  collectIgnoredIds,
  findStaleSuppressions,
  removeStaleEntries,
  type GrypeScanResult,
  type GrypeConfig,
} from "./audit-grype-suppressions.lib";

describe("collectIgnoredIds", () => {
  it.each([
    {
      name: "undefined ignoredMatches",
      scan: {} as GrypeScanResult,
      expected: new Set<string>(),
    },
    {
      name: "empty ignoredMatches",
      scan: { ignoredMatches: [] } as GrypeScanResult,
      expected: new Set<string>(),
    },
    {
      name: "primary vulnerability IDs",
      scan: {
        ignoredMatches: [
          { vulnerability: { id: "CVE-2024-0001" } },
          { vulnerability: { id: "CVE-2024-0002" } },
        ],
      },
      expected: new Set(["CVE-2024-0001", "CVE-2024-0002"]),
    },
    {
      name: "includes relatedVulnerabilities IDs",
      scan: {
        ignoredMatches: [
          {
            vulnerability: { id: "CVE-2024-0001" },
            relatedVulnerabilities: [{ id: "GHSA-xxxx-yyyy-zzzz" }, { id: "CVE-2024-0001-alt" }],
          },
        ],
      },
      expected: new Set(["CVE-2024-0001", "GHSA-xxxx-yyyy-zzzz", "CVE-2024-0001-alt"]),
    },
    {
      name: "deduplicates IDs across matches",
      scan: {
        ignoredMatches: [
          { vulnerability: { id: "CVE-2024-0001" } },
          {
            vulnerability: { id: "CVE-2024-0002" },
            relatedVulnerabilities: [{ id: "CVE-2024-0001" }],
          },
        ],
      },
      expected: new Set(["CVE-2024-0001", "CVE-2024-0002"]),
    },
  ])("$name", ({ scan, expected }) => {
    expect(collectIgnoredIds(scan)).toEqual(expected);
  });
});

describe("findStaleSuppressions", () => {
  it.each([
    {
      name: "returns empty when entries is undefined",
      entries: undefined as GrypeConfig["ignore"],
      ignoredIds: new Set(["CVE-2024-0001"]),
      expectedStale: [],
      expectedSkipped: [],
    },
    {
      name: "returns empty when all entries are actively ignored",
      entries: [{ vulnerability: "CVE-2024-0001" }, { vulnerability: "CVE-2024-0002" }],
      ignoredIds: new Set(["CVE-2024-0001", "CVE-2024-0002"]),
      expectedStale: [],
      expectedSkipped: [],
    },
    {
      name: "identifies stale entries not in ignoredIds",
      entries: [
        { vulnerability: "CVE-2024-0001" },
        { vulnerability: "CVE-2024-0002" },
        { vulnerability: "CVE-2024-0003" },
      ],
      ignoredIds: new Set(["CVE-2024-0002"]),
      expectedStale: ["CVE-2024-0001", "CVE-2024-0003"],
      expectedSkipped: [],
    },
    {
      name: "skips multi-key entries instead of aborting",
      entries: [
        { vulnerability: "CVE-2024-0001" },
        { vulnerability: "CVE-2024-0002", reason: "false-positive" },
        { vulnerability: "CVE-2024-0003", "fix-state": "wont-fix" },
      ] as NonNullable<GrypeConfig["ignore"]>,
      ignoredIds: new Set<string>(),
      expectedStale: ["CVE-2024-0001"],
      expectedSkipped: [
        { vulnerability: "CVE-2024-0002", keys: ["vulnerability", "reason"] },
        { vulnerability: "CVE-2024-0003", keys: ["vulnerability", "fix-state"] },
      ],
    },
    {
      name: "skips entries with non-vulnerability keys",
      entries: [{ vulnerability: "CVE-2024-0001", package: { name: "foo" } }] as NonNullable<
        GrypeConfig["ignore"]
      >,
      ignoredIds: new Set<string>(),
      expectedStale: [],
      expectedSkipped: [{ vulnerability: "CVE-2024-0001", keys: ["vulnerability", "package"] }],
    },
  ])("$name", ({ entries, ignoredIds, expectedStale, expectedSkipped }) => {
    const result = findStaleSuppressions(entries, ignoredIds);
    expect(result.staleIds).toEqual(expectedStale);
    expect(result.skippedEntries).toEqual(expectedSkipped);
  });
});

describe("removeStaleEntries", () => {
  it.each([
    {
      name: "returns original content when config has no ignore key",
      yaml: "key: value\n",
      staleIds: ["CVE-2024-0001"],
      expectedIgnore: undefined,
      preserveExact: true,
    },
    {
      name: "removes stale entries from ignore list",
      yaml: dump({
        ignore: [
          { vulnerability: "CVE-2024-0001" },
          { vulnerability: "CVE-2024-0002" },
          { vulnerability: "CVE-2024-0003" },
        ],
      }),
      staleIds: ["CVE-2024-0001", "CVE-2024-0003"],
      expectedIgnore: [{ vulnerability: "CVE-2024-0002" }],
    },
    {
      name: "removes ignore key entirely when all entries are stale",
      yaml: dump({ ignore: [{ vulnerability: "CVE-2024-0001" }] }),
      staleIds: ["CVE-2024-0001"],
      expectedIgnore: undefined,
    },
    {
      name: "handles quoted vulnerability IDs in YAML",
      yaml: `ignore:\n  - vulnerability: 'CVE-2024-0001'\n  - vulnerability: "CVE-2024-0002"\n  - vulnerability: CVE-2024-0003\n`,
      staleIds: ["CVE-2024-0001", "CVE-2024-0003"],
      expectedIgnore: [{ vulnerability: "CVE-2024-0002" }],
    },
    {
      name: "preserves non-ignore config keys",
      yaml: `db:\n  auto-update: true\nignore:\n  - vulnerability: CVE-2024-0001\n  - vulnerability: CVE-2024-0002\n`,
      staleIds: ["CVE-2024-0001"],
      expectedIgnore: [{ vulnerability: "CVE-2024-0002" }],
      expectedDb: { "auto-update": true },
    },
    {
      name: "preserves multi-key entries that are not targeted",
      yaml: dump({
        ignore: [
          { vulnerability: "CVE-2024-0001" },
          { vulnerability: "CVE-2024-0002", reason: "false-positive" },
        ],
      }),
      staleIds: ["CVE-2024-0001"],
      expectedIgnore: [{ vulnerability: "CVE-2024-0002", reason: "false-positive" }],
    },
    {
      name: "handles empty staleIds (no-op)",
      yaml: dump({ ignore: [{ vulnerability: "CVE-2024-0001" }] }),
      staleIds: [],
      expectedIgnore: [{ vulnerability: "CVE-2024-0001" }],
    },
    {
      name: "handles flow-style YAML entries",
      yaml: `ignore:\n  - {vulnerability: CVE-2024-0001}\n  - {vulnerability: CVE-2024-0002}\n`,
      staleIds: ["CVE-2024-0001"],
      expectedIgnore: [{ vulnerability: "CVE-2024-0002" }],
    },
  ])("$name", ({ yaml, staleIds, expectedIgnore, preserveExact, expectedDb }) => {
    const result = removeStaleEntries(yaml, staleIds);
    if (preserveExact) {
      expect(result).toBe(yaml);
    } else {
      const parsed = load(result) as GrypeConfig;
      expect(parsed.ignore).toEqual(expectedIgnore);
      if (expectedDb) {
        expect(parsed.db).toEqual(expectedDb);
      }
    }
  });
});
