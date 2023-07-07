// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, ValidateResponse } from "./k8s/types";
import Log from "./logger";
import { PeprObserveRequest } from "./observe-request";

export async function observeProcessor(
  capabilities: Capability[],
  req: Request,
  parentPrefix: string
): Promise<ValidateResponse> {
  const wrapped = new PeprObserveRequest(req);

  Log.info(`Processing request observation`, parentPrefix);

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
        const success = await action.validateCallback(wrapped);
        Log.info(`Action completed: ${success ? "success" : "failure"}`, prefix);
      } catch (e) {
        // If any validation throws an error, note the failure in the Response
        Log.error(`Action failed: ${e}`, prefix);
      }
    }
  }

  return {
    uid: req.uid,
    allowed: true,
  };
}
