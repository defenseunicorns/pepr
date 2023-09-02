// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ModuleCapabilities } from "./loader";
/**
 * Extract labels from a capabilities
 *
 * @param assets The webhook application
 * @param hash Generated hash
 * @returns { key:[string]: string } which represents the labels
 */
export function extractLabelsFromCapabilities(
  capabilities: ModuleCapabilities[],
  hash: string,
): {
  [key: string]: string;
} {
  const labels: { [key: string]: string } = {};

  capabilities.map(capability => (labels[capability._name] = hash.substring(0, 5)));
  return labels;
}
