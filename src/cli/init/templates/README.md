<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Pepr Module](#pepr-module)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Pepr Module

This is a Pepr Module. [Pepr](https://github.com/defenseunicorns/pepr) is a Kubernetes transformation system
written in Typescript.

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
