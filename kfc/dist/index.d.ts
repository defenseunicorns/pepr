import "./patch";
import * as kind from "./upstream";
/** kind is a collection of K8s types to be used within a K8s call: `K8s(kind.Secret).Apply({})`. */
export { kind };
export { fetch } from "./fetch";
export { StatusCodes as fetchStatus } from "http-status-codes";
export { WatchCfg, WatchEvent } from "./fluent/watch";
export { K8s } from "./fluent";
export { RegisterKind, modelToGroupVersionKind } from "./kinds";
export { GenericKind } from "./types";
export * from "./types";
export * as models from "@kubernetes/client-node/dist/gen/models/all";
export { fromEnv, waitForCluster } from "./helpers";
//# sourceMappingURL=index.d.ts.map