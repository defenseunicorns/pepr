// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { ModuleConfig } from "../types";

export function getIgnoreNamespaces(config?: ModuleConfig): string[] {
  const fromConfig = config?.alwaysIgnore?.namespaces?.length
    ? config.alwaysIgnore.namespaces
    : config?.admission?.alwaysIgnore?.namespaces;

  return resolveIgnoreNamespaces(fromConfig);
}

export function resolveIgnoreNamespaces(ignoredNSConfig: string[] = []): string[] {
  const ignoredNSEnv = process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES;
  if (!ignoredNSEnv) {
    return ignoredNSConfig;
  }

  const namespaces = ignoredNSEnv.split(",").map(ns => ns.trim());

  // add alwaysIgnore.namespaces to the list
  if (ignoredNSConfig) {
    namespaces.push(...ignoredNSConfig);
  }
  return namespaces.filter(ns => ns.length > 0);
}
