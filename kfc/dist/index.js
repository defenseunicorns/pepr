"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCluster = exports.fromEnv = exports.models = exports.GenericKind = exports.modelToGroupVersionKind = exports.RegisterKind = exports.K8s = exports.WatchEvent = exports.fetchStatus = exports.kind = void 0;
require("./patch");
// Export kinds as a single object
const kind = __importStar(require("./upstream"));
exports.kind = kind;
// Export the node-fetch wrapper
var fetch_1 = require("./fetch");
Object.defineProperty(exports, "fetch", { enumerable: true, get: function () { return fetch_1.fetch; } });
// Export the HTTP status codes
var http_status_codes_1 = require("http-status-codes");
Object.defineProperty(exports, "fetchStatus", { enumerable: true, get: function () { return http_status_codes_1.StatusCodes; } });
// Export the Watch Config and Event types
var watch_1 = require("./fluent/watch");
Object.defineProperty(exports, "WatchEvent", { enumerable: true, get: function () { return watch_1.WatchEvent; } });
// Export the fluent API entrypoint
var fluent_1 = require("./fluent");
Object.defineProperty(exports, "K8s", { enumerable: true, get: function () { return fluent_1.K8s; } });
// Export helpers for working with K8s types
var kinds_1 = require("./kinds");
Object.defineProperty(exports, "RegisterKind", { enumerable: true, get: function () { return kinds_1.RegisterKind; } });
Object.defineProperty(exports, "modelToGroupVersionKind", { enumerable: true, get: function () { return kinds_1.modelToGroupVersionKind; } });
// Export the GenericKind interface for CRD registration
var types_1 = require("./types");
Object.defineProperty(exports, "GenericKind", { enumerable: true, get: function () { return types_1.GenericKind; } });
__exportStar(require("./types"), exports);
// Export the upstream raw models
exports.models = __importStar(require("@kubernetes/client-node/dist/gen/models/all"));
var helpers_1 = require("./helpers");
Object.defineProperty(exports, "fromEnv", { enumerable: true, get: function () { return helpers_1.fromEnv; } });
Object.defineProperty(exports, "waitForCluster", { enumerable: true, get: function () { return helpers_1.waitForCluster; } });
