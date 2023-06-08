// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request } from "./k8s/types";
import logger from "./logger";
import { Binding, Event } from "./types";

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the capability action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(binding: Binding, req: Request) {
  const { group, kind, version } = binding.kind || {};
  const { namespaces, labels, annotations, name } = binding.filters || {};
  const { metadata } = req.object || {};

  // Test for matching operation
  if (!binding.event.includes(req.operation) && !binding.event.includes(Event.Any)) {
    return true;
  }

  // Test name first, since it's the most specific
  if (name && name !== req.name) {
    return true;
  }

  // Test for matching kinds
  if (kind !== req.kind.kind) {
    return true;
  }

  // Test for matching groups
  if (group && group !== req.kind.group) {
    return true;
  }

  // Test for matching versions
  if (version && version !== req.kind.version) {
    return true;
  }

  // Test for matching namespaces
  if (namespaces.length && !namespaces.includes(req.namespace || "")) {
    logger.debug("Namespace does not match");
    return true;
  }

  // Test for matching labels
  for (const [key, value] of Object.entries(labels)) {
    const testKey = metadata?.labels?.[key];

    // First check if the label exists
    if (!testKey) {
      logger.debug(`Label ${key} does not exist`);
      return true;
    }

    // Then check if the value matches, if specified
    if (value && testKey !== value) {
      logger.debug(`${testKey} does not match ${value}`);
      return true;
    }
  }

  // Test for matching annotations
  for (const [key, value] of Object.entries(annotations)) {
    const testKey = metadata?.annotations?.[key];

    // First check if the annotation exists
    if (!testKey) {
      logger.debug(`Annotation ${key} does not exist`);
      return true;
    }

    // Then check if the value matches, if specified
    if (value && testKey !== value) {
      logger.debug(`${testKey} does not match ${value}`);
      return true;
    }
  }

  // No failed filters, so we should not skip this request
  return false;
}
