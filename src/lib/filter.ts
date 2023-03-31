// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request } from "./k8s";
import logger from "./logger";
import { Binding } from "./types";

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the capability action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(binding: Binding, req: Request) {
  const { group, kind, version } = binding.kind;
  const { namespaces, labels, annotations } = binding.filters;
  const { metadata } = req.object;

  if (kind !== req.kind.kind) {
    logger.debug(`${req.kind.kind} does not match ${kind}`);
    return true;
  }

  if (group && group !== req.kind.group) {
    logger.debug(`${req.kind.group} does not match ${group}`);
    return true;
  }

  if (version && version !== req.kind.version) {
    logger.debug(`${req.kind.version} does not match ${version}`);
    return true;
  }

  if (namespaces.length && !namespaces.includes(req.namespace || "")) {
    logger.debug(`${req.namespace} is not in ${namespaces}`);
    return true;
  }

  for (const [key, value] of Object.entries(labels)) {
    if (metadata?.labels?.[key] !== value) {
      logger.debug(`${metadata?.labels?.[key]} does not match ${value}`);
      return true;
    }
  }

  for (const [key, value] of Object.entries(annotations)) {
    if (metadata?.annotations?.[key] !== value) {
      logger.debug(`${metadata?.annotations?.[key]} does not match ${value}`);
      return true;
    }
  }

  return false;
}
