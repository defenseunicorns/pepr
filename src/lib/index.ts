import k8s from "@kubernetes/client-node";
import { StatusCodes as fetchStatus } from "http-status-codes";
import * as utils from "ramda";
import { Capability } from "./capability.js";
import { fetch, fetchRaw } from "./fetch.js";
import { RegisterKind, a } from "./k8s/index.js";
import Log from "./logger.js";
import { PeprModule } from "./module.js";
import { PeprRequest } from "./request.js";

// Import type information for external packages
import type * as KubernetesClientNode from "@kubernetes/client-node";
import type * as RamdaUtils from "ramda";

export {
  a,
  /** PeprModule is used to setup a complete Pepr Module: `new PeprModule(cfg, {...capabilities})` */
  PeprModule,
  PeprRequest,
  RegisterKind,
  Capability,
  Log,
  utils,
  fetch,
  fetchRaw,
  fetchStatus,
  k8s,

  // Export the imported type information for external packages
  RamdaUtils,
  KubernetesClientNode,
};
