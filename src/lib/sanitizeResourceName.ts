// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Sanitize a resource name to make it a valid Kubernetes resource name.
 *
 * @param name the name of the resource to sanitize
 * @returns the sanitized resource name
 *
 * https://kubernetes.io/docs/concepts/overview/working-with-objects/names/
 */
export function sanitizeResourceName(name: string): string {
  return (
    name
      .toLowerCase()
      // Replace invalid characters (anything not a-z, 0-9, or '-') with '-'
      .replace(/[^a-z0-9-]+/g, "-")
      // Trim to 63 characters (https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#rfc-1035-label-names)
      .slice(0, 63)
      // Remove leading non-alphanumeric characters
      .replace(/^[^a-z0-9]+/, "")
      // Remove trailing non-alphanumeric characters
      .replace(/[^a-z0-9]+$/, "")
  );
}
