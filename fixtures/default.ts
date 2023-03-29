import { Operation, Request } from "@k8s";
import { State } from "@pepr";
import { Pod } from "sdk/k8s/upstream";
import logger from "sdk/logger";
import { POD } from "./loader";

import TestMutations from "./test-mutations";

const state = new State({
  id: "20e17cf6-a2e4-46b2-b626-75d88d96c88b",
  description: "",
  alwaysIgnore: {
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
  rejectOnError: false,
});

export const { ProcessRequest } = state;

TestMutations(state.Register);

const example = POD();

const request = ProcessRequest(example);
logger.info(request, "Final response");
