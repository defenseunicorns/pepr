import { PeprModule } from "pepr";
import { KeyCloakPepr } from "./capabilities/keycloak-pepr";
import cfg from "./package.json";


new PeprModule(cfg, [
  KeyCloakPepr,

  // Your additional capabilities go here
]);
