import { Log } from ".";
import cfg from "./package.json";
import { TestMutations } from "./src/fixtures/test-mutations";
import { PeprModule } from "./src/lib/module";

Log.SetLogLevel("debug");

// This initializes the Pepr module with the configuration from package.json
new PeprModule(cfg, [TestMutations]);
