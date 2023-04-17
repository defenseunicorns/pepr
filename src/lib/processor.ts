// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { compare } from "fast-json-patch";
import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, Response } from "./k8s/types";
import logger from "./logger";
import { PeprRequest } from "./request";
import { ModuleConfig } from "./types";

export async function processor(config: ModuleConfig, capabilities: Capability[], req: Request): Promise<Response> {
  const wrapped = new PeprRequest(req);
  const response: Response = {
    uid: req.uid,
    warnings: [],
    allowed: false,
  };

  logger.info(`Processing '${req.uid}' for '${req.kind.kind}' '${req.name}'`);

  for (const { name, bindings } of capabilities) {
    const prefix = `${req.uid} ${req.name}: ${name}`;
    logger.info(`Processing capability ${name}`, prefix);

    for (const action of bindings) {
      // Continue to the next action without doing anything if this one should be skipped
      if (shouldSkipRequest(action, req)) {
        continue;
      }

      logger.info(`Processing matched action ${action.kind.kind}`, prefix);

      // Add annotations to the request to indicate that the capability started processing
      // this will allow tracking of failed mutations that were permitted to continue
      const { metadata } = wrapped.Raw;
      const identifier = `${config.uuid}.pepr.dev/${name}`;
      metadata.annotations = metadata.annotations || {};
      metadata.annotations[identifier] = "started";

      try {
        // Run the action
        await action.callback(wrapped);

        // Add annotations to the request to indicate that the capability succeeded
        metadata.annotations[identifier] = "succeeded";
      } catch (e) {
        response.warnings.push(`Action failed: ${e}`);

        // If errors are not allowed, note the failure in the Reponse
        if (config.onError) {
          logger.error(`Action failed: ${e}`, prefix);
          response.result = "Pepr module configured to reject on error";
          return response;
        } else {
          logger.warn(`Action failed: ${e}`, prefix);
          metadata.annotations[identifier] = "warning";
        }
      }
    }
  }

  // If we've made it this far, the request is allowed
  response.allowed = true;

  // Compare the original request to the modified request to get the patches
  const patches = compare(req.object, wrapped.Raw);

  // Only add the patch if there are patches to apply
  if (patches.length > 0) {
    response.patchType = "JSONPatch";
    // Webhook must be base64-encoded
    // https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#response
    response.patch = Buffer.from(JSON.stringify(patches)).toString("base64");
  }

  // Remove the warnings array if it's empty
  if (response.warnings.length < 1) {
    delete response.warnings;
  }

  logger.debug(patches);

  return response;
}
