import { PeprModule } from "pepr";
import { HelloPepr } from "./capabilities/hello-pepr";
import cfg from "./package.json";

/**
 * This is the main entrypoint for the Pepr module. It is the file that is run when the module is started.
 * This is where you register your configurations and capabilities with the module.
 */
new PeprModule(cfg, [
  // "HelloPepr" is a demo capability that is included with Pepr. You can remove it if you want.
  HelloPepr,

  // Your additional capabilities go here
]);
