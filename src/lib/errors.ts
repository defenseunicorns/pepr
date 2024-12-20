// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { OnError } from "../cli/init/enums";

export const ErrorList = Object.values(OnError) as string[];
/**
 * Validate the error or throw an error
 * @param error
 */
export function ValidateError(error: string = ""): void {
  if (!ErrorList.includes(error)) {
    throw new Error(`Invalid error: ${error}. Must be one of: ${ErrorList.join(", ")}`);
  }
}
