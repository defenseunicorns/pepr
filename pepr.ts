import { PeprModule } from "./src/lib";
import cfg from "./package.json";

// This initializes the Pepr module with the configuration from package.json
export const { Register, ProcessRequest } = new PeprModule(cfg);
