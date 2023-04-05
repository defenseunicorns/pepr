import packageJSON from "../../package.json";
import { Log, PeprModule } from "@lib";
import { CM1, DEPLOYMENT1, NS1, POD1, POD2, SVC1 } from "./loader";

import TestMutations from "./test-mutations";

export const peprModule = new PeprModule(packageJSON, {
  alwaysIgnore: {
    namespaces: ["kube-system", "pepr-system"],
    labels: [{ "pepr.dev": "ignore" }],
  },
});

export const { ProcessRequest } = peprModule;

TestMutations(peprModule.Register);

Log.info(ProcessRequest(SVC1()), "svc1");
Log.info(ProcessRequest(POD1()), "pod1");
Log.info(ProcessRequest(POD2()), "pod2");
Log.info(ProcessRequest(CM1()), "cm1");
Log.info(ProcessRequest(NS1()), "ns1");
Log.info(ProcessRequest(DEPLOYMENT1()), "deployment1");
