// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { AdmissionRequest, ValidateResponse } from "./k8s";
import Log from "./logger";
import { convertFromBase64Map } from "./utils";
import { PeprValidateRequest } from "./validate-request";

export async function validateProcessor(
  capabilities: Capability[],
  req: AdmissionRequest,
  reqMetadata: Record<string, string>,
): Promise<ValidateResponse[]> {
  const wrapped = new PeprValidateRequest(req);
  const response: ValidateResponse[] = [];

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version == "v1" && req.kind.kind == "Secret";
  if (isSecret) {
    convertFromBase64Map(wrapped.Raw as unknown as kind.Secret);
  }

  Log.info(reqMetadata, `Processing validation request`);

  for (const { name, bindings, namespaces } of capabilities) {
    const actionMetadata = { ...reqMetadata, name };

    for (const action of bindings) {
      // Skip this action if it's not a validation action
      if (!action.validateCallback) {
        continue;
      }

      const localResponse: ValidateResponse = {
        uid: req.uid,
        allowed: true, // Assume it's allowed until a validation check fails
      };

      // Continue to the next action without doing anything if this one should be skipped
      if (shouldSkipRequest(action, req, namespaces)) {
        continue;
      }

      const label = action.validateCallback.name;
      Log.info(actionMetadata, `Processing matched action ${label}`);

      try {
        // Run the validation callback, if it fails set allowed to false
        const resp = await action.validateCallback(wrapped);
        localResponse.allowed = resp.allowed;

        // If the validation callback returned a status code or message, set it in the Response
        if (resp.statusCode || resp.statusMessage) {
          localResponse.status = {
            code: resp.statusCode || 400,
            message: resp.statusMessage || `Validation failed for ${name}`,
          };
        }

        Log.info(actionMetadata, `Validation Action completed: ${resp.allowed ? "allowed" : "denied"}`);
      } catch (e) {
        // If any validation throws an error, note the failure in the Response
        Log.error(actionMetadata, `Action failed: ${e}`);
        localResponse.allowed = false;
        localResponse.status = {
          code: 500,
          message: `Action failed with error: ${e}`,
        };
        return [localResponse];
      }
      response.push(localResponse);
    }
  }

  return response;
}
