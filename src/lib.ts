import { K8s, RegisterKind, fetch, kind, kind as a, fetchStatus } from "kubernetes-fluent-client";
import * as R from "ramda";

import { Capability } from "./lib/capability";
import Log from "./lib/logger";
import { PeprModule } from "./lib/module";
import { PeprMutateRequest } from "./lib/mutate-request";
import { PeprValidateRequest } from "./lib/validate-request";
import * as PeprUtils from "./lib/utils";

// Import type information for external packages
import type * as RTypes from "ramda";

export {
  a,
  kind,
  /** PeprModule is used to setup a complete Pepr Module: `new PeprModule(cfg, {...capabilities})` */
  PeprModule,
  PeprMutateRequest,
  PeprValidateRequest,
  PeprUtils,
  RegisterKind,
  K8s,
  Capability,
  Log,
  R,
  fetch,
  fetchStatus,

  // Export the imported type information for external packages
  RTypes,
};
