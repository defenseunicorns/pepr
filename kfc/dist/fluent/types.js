"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchPhase = void 0;
/**
 * The Phase matched when using the K8s Watch API.
 */
var WatchPhase;
(function (WatchPhase) {
    WatchPhase["Added"] = "ADDED";
    WatchPhase["Modified"] = "MODIFIED";
    WatchPhase["Deleted"] = "DELETED";
    WatchPhase["Bookmark"] = "BOOKMARK";
    WatchPhase["Error"] = "ERROR";
})(WatchPhase || (exports.WatchPhase = WatchPhase = {}));
