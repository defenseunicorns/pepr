// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import jsonPatch from "fast-json-patch";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, Response } from "./k8s/types";
import { Secret } from "./k8s/upstream";
import Log from "./logger";
import { PeprRequest } from "./request";
import { ModuleConfig } from "./types";
import { convertFromBase64Map, convertToBase64Map } from "./utils";

export async function processor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: Request,
  parentPrefix: string
): Promise<Response> {
  const wrapped = new PeprRequest(req);
  const response: Response = {
    uid: req.uid,
    warnings: [],
    allowed: false,
  };

  // Track whether any capability matched the request
  let matchedCapabilityAction = false;

  // Track data fields that should be skipped during decoding
  let skipDecode: string[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version == "v1" && req.kind.kind == "Secret";
  if (isSecret) {
    skipDecode = convertFromBase64Map(wrapped.Raw as unknown as Secret);
  }

  Log.info(`Processing request`, parentPrefix);

  for (const { name, bindings } of capabilities) {
    const prefix = `${parentPrefix} ${name}:`;

    for (const action of bindings) {
      // Continue to the next action without doing anything if this one should be skipped
      if (shouldSkipRequest(action, req)) {
        continue;
      }

      const label = action.callback.name;
      Log.info(`Processing matched action ${label}`, prefix);

      matchedCapabilityAction = true;

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

        Log.info(`Action succeeded`, prefix);

        // Add annotations to the request to indicate that the capability succeeded
        updateStatus("succeeded");
      } catch (e) {
        // Annoying ts false positive
        response.warnings = response.warnings || [];
        response.warnings.push(`Action failed: ${e}`);

        // If errors are not allowed, note the failure in the Response
        if (config.onError) {
          Log.error(`Action failed: ${e}`, prefix);
          response.result = "Pepr module configured to reject on error";
          return response;
        } else {
          Log.warn(`Action failed: ${e}`, prefix);
          updateStatus("warning");
        }
      }
    }
  }

  // If we've made it this far, the request is allowed
  response.allowed = true;

  // If no capability matched the request, exit early
  if (!matchedCapabilityAction) {
    Log.info(`No matching capability action found`, parentPrefix);
    return response;
  }

  const transformed = wrapped.Raw;

  // Post-process the Secret requests to convert it back to the original format
  if (isSecret) {
    convertToBase64Map(transformed as unknown as Secret, skipDecode);
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

  Log.debug(patches, parentPrefix);

  return response;
}
