// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Operation type for mutation operations
export enum Operation {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CONNECT = "CONNECT",
}

/**
 * The type of Kubernetes mutating webhook event that the action is registered for
 */
export enum Event {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CREATE_OR_UPDATE = "CREATEORUPDATE",
  ANY = "*",
}

// Supported webhook types for @kubernetes/client-node's V1MutatingWebhookConfiguration
export enum WebhookType {
  MUTATE = "mutate",
  VALIDATE = "validate",
}
