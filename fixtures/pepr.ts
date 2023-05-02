// Importing the PeprModule class from the module file
import { PeprModule } from "../src/lib/module";

// Importing the configuration object from package.json
import cfg from "../package.json";

// Importing the TestMutations class from the test-mutations file
import { TestMutations } from "./test-mutations";

// Importing the Log class from the logger file
import Log from "../src/lib/logger";

// Setting the log level to debug
Log.SetLogLevel("debug");

// Initializing the Pepr module with the configuration and mutations
const peprModule = new PeprModule(cfg, [TestMutations]);

// Exporting the peprModule object
export default peprModule;