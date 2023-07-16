// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { clone } from "ramda";

import { Capability } from "./capability";
import { shouldSkipRequest } from "./filter";
import { Request, ValidateResponse } from "./k8s/types";
import Log from "./logger";

export async function observeProcessor(
  capabilities: Capability[],
  req: Request,
  parentPrefix: string
): Promise<ValidateResponse> {
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
        // Run the observe callback
        await action.observeCallback(clone(req.object), clone(req.oldObject));
        Log.info(`Action succeeded`, prefix);
      } catch (e) {
        // If any observe throws an error, log the failure
        Log.error(`Action failed: ${e}`, prefix);
      }
    }
  }

  // Always allow the request to continue as this is an observe action only
  return {
    uid: req.uid,
    allowed: true,
  };
}
