// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, ValidateResponse } from "./k8s/types";
import { Secret } from "./k8s/upstream";
import Log from "./logger";
import { convertFromBase64Map } from "./utils";
import { PeprValidateRequest } from "./validate-request";

export async function validateProcessor(
  capabilities: Capability[],
  req: Request,
  reqMetadata: Record<string, string>,
): Promise<ValidateResponse> {
  const wrapped = new PeprValidateRequest(req);
  const response: ValidateResponse = {
    uid: req.uid,
    allowed: true, // Assume it's allowed until a validation check fails
  };

  // If the resource is a secret, decode the data
  const isSecret = req.kind.version == "v1" && req.kind.kind == "Secret";
  if (isSecret) {
    convertFromBase64Map(wrapped.Raw as unknown as Secret);
  }

  Log.info(reqMetadata, `Processing validation request`);

  for (const { name, bindings } of capabilities) {
    const actionMetadata = { ...reqMetadata, name };

    for (const action of bindings) {
      // Skip this action if it's not a validation action
      if (!action.validateCallback) {
        continue;
      }

      // Continue to the next action without doing anything if this one should be skipped
      if (shouldSkipRequest(action, req)) {
        continue;
      }

      const label = action.validateCallback.name;
      Log.info(actionMetadata, `Processing matched action ${label}`);

      try {
        // Run the validation callback, if it fails set allowed to false
        const resp = await action.validateCallback(wrapped);
        response.allowed = resp.allowed;

        // If the validation callback returned a status code or message, set it in the Response
        if (resp.statusCode || resp.statusMessage) {
          response.status = {
            code: resp.statusCode || 400,
            message: resp.statusMessage || `Validation failed for ${name}`,
          };
        }

        Log.info(actionMetadata, `Validation Action completed: ${resp.allowed ? "allowed" : "denied"}`);
      } catch (e) {
        // If any validation throws an error, note the failure in the Response
        Log.error(actionMetadata, `Action failed: ${e}`);
        response.allowed = false;
        response.status = {
          code: 500,
          message: `Action failed with error: ${e}`,
        };
        return response;
      }
    }
  }

  return response;
}
