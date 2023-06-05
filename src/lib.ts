import k8s from "@kubernetes/client-node";
import { StatusCodes as fetchStatus } from "http-status-codes";
import * as utils from "ramda";
import { Capability } from "./lib/capability";
import { fetch, fetchRaw } from "./lib/fetch";
import { RegisterKind, a } from "./lib/k8s/index";
import Log from "./lib/logger";
import { PeprModule } from "./lib/module";
import { PeprRequest } from "./lib/request";
import * as PeprUtils from "./lib/utils";

// Import type information for external packages
import type * as KubernetesClientNode from "@kubernetes/client-node";
import type * as RamdaUtils from "ramda";

export {
  a,
  /** PeprModule is used to setup a complete Pepr Module: `new PeprModule(cfg, {...capabilities})` */
  PeprModule,
  PeprRequest,
  PeprUtils,
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
