"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericKind = void 0;
/**
 * GenericKind is a generic Kubernetes object that can be used to represent any Kubernetes object
 * that is not explicitly supported. This can be used on its own or as a base class for
 * other types.
 */
class GenericKind {
    apiVersion;
    kind;
    metadata;
}
exports.GenericKind = GenericKind;
