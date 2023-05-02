import { Log, PeprModule } from "pepr";
import { HelloPepr } from "./capabilities/hello-pepr";
import cfg from "./package.json";

/**
 * This is the main entrypoint for this Pepr module. It is run when the module is started.
 * This is where you register your Pepr configurations and capabilities.
 */

// Register capabilities
const capabilities = [
  // "HelloPepr" is a demo capability that is included with Pepr. Comment or delete the line below to remove it.
  HelloPepr,

  // Your additional capabilities go here
];

// Define hooks
const beforeHook = (req) => {
  Log.debug(`beforeHook: ${req.uid}`);
};

const afterHook = (res) => {
  Log.debug(`afterHook: ${res.uid}`);
};

// Initialize PeprModule
new PeprModule(cfg, capabilities, { beforeHook, afterHook });