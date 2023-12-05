# Pepr Module

This is a Pepr Module. [Pepr](https://github.com/defenseunicorns/pepr) is a type-safe Kubernetes middleware system.

The `capabilities` directory contains all the capabilities for this module. By default,
a capability is a single typescript file in the format of `capability-name.ts` that is
imported in the root `pepr.ts` file as `import { HelloPepr } from "./capabilities/hello-pepr";`.
Because this is typescript, you can organize this however you choose, e.g. creating a sub-folder
per-capability or common logic in shared files or folders.

Example Structure:

```
Module Root
├── package.json
├── pepr.ts
└── capabilities
    ├── example-one.ts
    ├── example-three.ts
    └── example-two.ts
```
