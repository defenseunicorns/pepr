// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import jsonPatch from "fast-json-patch";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, Response } from "./k8s/types";
import { Secret } from "./k8s/upstream";
import logger from "./logger";
import { PeprRequest, convertToBase64Map } from "./request";
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
      const updateStatus = (status: string) => {
        // Only update the status if the request is a CREATE or UPDATE (we don't use CONNECT)
        if (req.operation == "DELETE") {
          return;
        }

        const identifier = `${config.uuid}.pepr.dev/${name}`;
        wrapped.Raw.metadata = wrapped.Raw.metadata || {};
        wrapped.Raw.metadata.annotations = wrapped.Raw.metadata.annotations || {};
        wrapped.Raw.metadata.annotations[identifier] = status;
      };

      updateStatus("started");

      try {
        // Run the action
        await action.callback(wrapped);

        logger.info(`Action succeeded`, prefix);

        // Add annotations to the request to indicate that the capability succeeded
        updateStatus("succeeded");
      } catch (e) {
        // Annoying ts false positive
        response.warnings = response.warnings || [];
        response.warnings.push(`Action failed: ${e}`);

        // If errors are not allowed, note the failure in the Response
        if (config.onError) {
          logger.error(`Action failed: ${e}`, prefix);
          response.result = "Pepr module configured to reject on error";
          return response;
        } else {
          logger.warn(`Action failed: ${e}`, prefix);
          updateStatus("warning");
        }
      }
    }
  }

  // If we've made it this far, the request is allowed
  response.allowed = true;

  const transformed = wrapped.Raw;

  // Post-process the Secret requests to convert it back to the original format
  if (req.kind.version == "v1" && req.kind.kind == "Secret") {
    convertToBase64Map(transformed as unknown as Secret);
  }

  // Compare the original request to the modified request to get the patches
  const patches = jsonPatch.compare(req.object, transformed);

  // Only add the patch if there are patches to apply
  if (patches.length > 0) {
    response.patchType = "JSONPatch";
    // Webhook must be base64-encoded
    // https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#response
    response.patch = Buffer.from(JSON.stringify(patches)).toString("base64");
  }

  // Remove the warnings array if it's empty
  if (response.warnings && response.warnings.length < 1) {
    delete response.warnings;
  }

  logger.debug(patches);

  return response;
}
