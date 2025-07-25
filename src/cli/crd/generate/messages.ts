// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export const ErrorMessages = {
  MISSING_DETAILS: "Missing 'details' variable declaration.",
  INVALID_SCOPE: (scope: string): string =>
    `'scope' must be either "Cluster" or "Namespaced", got "${scope}"`,
  MISSING_OR_INVALID_KEY: (key: string): string =>
    `Missing or invalid value for required key: '${key}'`,
};

export const WarningMessages = {
  MISSING_DETAILS: "Missing 'details' variable declaration.",
  MISSING_KIND_COMMENT: (fileName: string): string =>
    `Skipping ${fileName}: missing '// Kind: <KindName>' comment`,
  MISSING_INTERFACE: (fileName: string, kind: string): string =>
    `Skipping ${fileName}: missing interface ${kind}Spec`,
};
