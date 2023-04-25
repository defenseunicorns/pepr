import k8s from "@kubernetes/client-node";
import { StatusCodes as fetchStatus } from "http-status-codes";
import utils from "ramda";
import { Capability } from "./src/lib/capability";
import { fetch, fetchRaw } from "./src/lib/fetch";
import { RegisterKind, a } from "./src/lib/k8s";
import Log from "./src/lib/logger";
import { PeprModule } from "./src/lib/module";
import { PeprRequest } from "./src/lib/request";

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
