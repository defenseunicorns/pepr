/*
This is an example file to show how to work with Pepr capabilities. Before authoring 
Pepr capabilities, make sure to run the command `pepr setup` to configure this environment.
For the best experience, we recommend using VSCode or another IDE with TypeScript support.

NOTE: This file will be overwritten by the `pepr setup` command and should only be used for 
reference for ways to use the Pepr SDK. If you want to generate a new capability, run the
`pepr new` command.
*/
// Pepr Capability: example-thing
import Pepr from "@pepr";

let c = new Pepr.Capability({
  name: "example-thing",
  description: "Add some cool words here",
});

// WIP decide how to do the registration stuffs
c.RegisterCreate();
c.RegisterCreate();

c.RegisterUpdate();
c.RegisterUpdate();

c.RegisterDelete();
