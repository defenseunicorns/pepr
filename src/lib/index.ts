import k8s from "@kubernetes/client-node";
import { StatusCodes as fetchStatus } from "http-status-codes";
import utils from "ramda";
import { Capability } from "./capability";
import { fetch, fetchRaw } from "./fetch";
import { RegisterKind, a } from "./k8s";
import Log from "./logger";
import { PeprModule } from "./module";
import { PeprRequest } from "./request";

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
