// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dump, load } from "js-yaml";

export interface GrypeConfig {
  ignore?: { vulnerability: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface GrypeMatch {
  vulnerability: { id: string };
  relatedVulnerabilities?: { id: string }[];
}

export interface GrypeScanResult {
  matches?: GrypeMatch[];
  ignoredMatches?: GrypeMatch[];
}

export interface AuditResult {
  staleIds: string[];
  matchCount: number;
  skippedEntries: { vulnerability: string; keys: string[] }[];
}

export function collectIgnoredIds(scan: GrypeScanResult): Set<string> {
  const ids = new Set<string>();
  for (const match of scan.ignoredMatches ?? []) {
    ids.add(match.vulnerability.id);
    for (const relatedVuln of match.relatedVulnerabilities ?? []) {
      ids.add(relatedVuln.id);
    }
  }
  return ids;
}

export function findStaleSuppressions(
  entries: GrypeConfig["ignore"],
  ignoredIds: Set<string>,
): { staleIds: string[]; skippedEntries: { vulnerability: string; keys: string[] }[] } {
  const staleIds: string[] = [];
  const skippedEntries: { vulnerability: string; keys: string[] }[] = [];

  for (const entry of entries ?? []) {
    const keys = Object.keys(entry);
    if (keys.length > 1 || (keys.length === 1 && keys[0] !== "vulnerability")) {
      skippedEntries.push({ vulnerability: entry.vulnerability, keys });
      continue;
    }
    if (!ignoredIds.has(entry.vulnerability)) {
      staleIds.push(entry.vulnerability);
    }
  }

  return { staleIds, skippedEntries };
}

export function removeStaleEntries(yamlContent: string, staleIds: string[]): string {
  const staleSet = new Set(staleIds);
  const config = load(yamlContent) as GrypeConfig;
  if (!config?.ignore) return yamlContent;

  // Build the set of vulnerability IDs to keep
  const keptIds = new Set(
    config.ignore
      .map(entry => entry.vulnerability)
      .filter(id => !staleSet.has(id)),
  );

  // Remove stale lines from the raw YAML text to preserve comments and formatting.
  // Only simple single-key entries (- vulnerability: <id>) are ever marked stale by
  // findStaleSuppressions, so a line-based filter is safe here.
  const lines = yamlContent.split("\n");
  const filtered = lines.filter(line => {
    const m = line.match(/^\s*-\s+vulnerability:\s+(\S+)\s*$/);
    return !m || keptIds.has(m[1]) || !staleSet.has(m[1]);
  });

  // If the ignore list is now empty, remove the 'ignore:' key header too
  const result = filtered.join("\n");
  if (keptIds.size === 0) {
    return result.replace(/^ignore:\s*\n/m, "");
  }
  return result;
}
