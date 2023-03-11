// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export type Capability = {
  name: string;
  description: string;
};

/**
 * Register a capability with Pepr
 * @param capability The capability to register
 */
export function register(capability: Capability) {}
