// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import jsonPatch from "fast-json-patch";
import { kind } from "kubernetes-fluent-client";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter/shouldSkipRequest";
import { MutateResponse } from "./k8s";
import { AdmissionRequest } from "./types";
import Log, { processMutateError } from "./logger";
import { ModuleConfig } from "./module";
import { PeprMutateRequest } from "./mutate-request";
import { base64Encode, convertFromBase64Map, convertToBase64Map } from "./utils";

export async function mutateProcessor(
  config: ModuleConfig,
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<MutateResponse> {
  const wrapped = new PeprMutateRequest(req);
  const response: MutateResponse = {
    uid: req.uid,
    warnings: [],
    allowed: false,
  };

  // Track whether any capability matched the request
  let matchedAction = false;

  // Track data fields that should be skipped during decoding
  let skipDecode: string[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version === "v1" && req.kind.kind === "Secret";
  if (isSecret) {
    skipDecode = convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  Log.info(reqMetadata, `Processing request`);
  let processedResponse = response;
  for (const { name, bindings, namespaces } of capabilities) {
    const actionMetadata = { ...reqMetadata, name };
    for (const action of bindings) {
      // Skip this action if it's not a mutate action
      if (!action.mutateCallback) {
        continue;
      }

      // Continue to the next action without doing anything if this one should be skipped
      const shouldSkip = shouldSkipRequest(action, req, namespaces, config?.alwaysIgnore?.namespaces);
      if (shouldSkip !== "") {
        Log.debug(shouldSkip);
        continue;
      }

      const label = action.mutateCallback.name;
      Log.info(actionMetadata, `Processing mutation action (${label})`);
      matchedAction = true;

      // Add annotations to the request to indicate that the capability started processing
      // this will allow tracking of failed mutations that were permitted to continue
      const updateStatus = (status: string) => {
        // Only update the status if the request is a CREATE or UPDATE (we don't use CONNECT)
        if (req.operation === "DELETE") {
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
        await action.mutateCallback(wrapped);

        // Log on success
        Log.info(actionMetadata, `Mutation action succeeded (${label})`);

        // Add annotations to the request to indicate that the capability succeeded
        updateStatus("succeeded");
      } catch (e) {
        updateStatus("warning");
        processedResponse = processMutateError(actionMetadata, e, response, config.onError);
      }
    }
  }

  // If we've made it this far, the request is allowed
  processedResponse.allowed = true;

  // If no capability matched the request, exit early
  if (!matchedAction) {
    Log.info(reqMetadata, `No matching actions found`);
    return processedResponse;
  }

  // delete operations can't be mutate, just return before the transformation
  if (req.operation === "DELETE") {
    return processedResponse;
  }

  const transformed = wrapped.Raw;

  // Post-process the Secret requests to convert it back to the original format
  if (isSecret) {
    convertToBase64Map(transformed as unknown as kind.Secret, skipDecode);
  }

  // Compare the original request to the modified request to get the patches
  const patches = jsonPatch.compare(req.object, transformed);

  // Only add the patch if there are patches to apply
  if (patches.length > 0) {
    processedResponse.patchType = "JSONPatch";
    // Webhook must be base64-encoded
    // https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#processedResponse
    processedResponse.patch = base64Encode(JSON.stringify(patches));
  }

  // Remove the warnings array if it's empty
  if (processedResponse.warnings && processedResponse.warnings.length < 1) {
    delete processedResponse.warnings;
  }

  Log.debug({ ...reqMetadata, patches }, `Patches generated`);

  return processedResponse;
}
