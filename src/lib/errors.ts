// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export const Errors = {
  audit: "audit",
  ignore: "ignore",
  reject: "reject",
};

export const ErrorList = Object.values(Errors);

/**
 * Validate the error or throw an error
 * @param error
 */
export function ValidateError(error = ""): void {
  if (!ErrorList.includes(error)) {
    throw new Error(`Invalid error: ${error}. Must be one of: ${ErrorList.join(", ")}`);
  }
}
