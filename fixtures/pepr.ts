import cfg from "../package.json";
import Log from "../src/lib/logger";
import { PeprModule } from "../src/lib/module";
import { TestMutations } from "./test-mutations";

Log.SetLogLevel("debug");

// This initializes the Pepr module with the configuration from package.json
new PeprModule(cfg, [TestMutations]);
