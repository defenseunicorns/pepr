// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, ValidateResponse } from "./k8s/types";
import Log from "./logger";
import { PeprValidateRequest } from "./validate-request";

export async function validateProcessor(
  capabilities: Capability[],
  req: Request,
  parentPrefix: string
): Promise<ValidateResponse> {
  const wrapped = new PeprValidateRequest(req);
  const response: ValidateResponse = {
    uid: req.uid,
    allowed: true, // Assume it's allowed until a validation check fails
  };

  Log.info(`Processing validation request`, parentPrefix);

  for (const { name, bindings } of capabilities) {
    const prefix = `${parentPrefix} ${name}:`;

    for (const action of bindings) {
      // Continue to the next action without doing anything if this one should be skipped
      if (shouldSkipRequest(action, req)) {
        continue;
      }

      const label = action.validateCallback.name;
      Log.info(`Processing matched action ${label}`, prefix);

      try {
        // Run the validation callback, if it fails set allowed to false
        const isValid = await action.validateCallback(wrapped);
        if (!isValid) {
          response.allowed = false;
          response.status = {
            code: 400,
            message: `Validation failed in action ${label}`,
          };
        }

        Log.info(`Action succeeded`, prefix);
      } catch (e) {
        // If any validation throws an error, note the failure in the Response
        Log.error(`Action failed: ${e}`, prefix);
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
