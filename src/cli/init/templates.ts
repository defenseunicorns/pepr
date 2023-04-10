// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { inspect } from "util";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { dependencies, version } from "../../../package.json";
import { sanitizeName } from "./utils";
import { InitOptions } from "./walkthrough";
import { dumpYaml } from "@kubernetes/client-node";

export function genPeprTS() {
  return {
    path: "pepr.ts",
    data: `import { PeprModule } from "pepr";
import cfg from "./package.json";
import { HelloPepr } from "./capabilities/hello-pepr";

/**
 * This is the main entrypoint for the Pepr module. It is the file that is run when the module is started.
 * This is where you register your configurations and capabilities with the module.
 */
new PeprModule(cfg, [
  // "HelloPepr" is a demo capability that is included with Pepr. You can remove it if you want.
  HelloPepr,

  // Your additional capabilities go here
]);    
`,
  };
}

export function genPkgJSON(opts: InitOptions) {
  // Generate a random UUID for the module based on the module name
  const uuid = uuidv5(opts.name, uuidv4());
  // Generate a name for the module based on the module name
  const name = sanitizeName(opts.name);
  // Make typescript a dev dependency
  const { typescript } = dependencies;

  const data = {
    name,
    version: "0.0.1",
    description: opts.description,
    keywords: ["pepr", "k8s", "policy-engine", "pepr-module", "security"],
    pepr: {
      name: opts.name.trim(),
      version,
      uuid,
      onError: opts.errorBehavior,
      alwaysIgnore: {
        namespaces: [],
        labels: [],
      },
    },
    scripts: {
      build: "pepr build",
      start: "pepr dev",
    },
    dependencies: {
      pepr: `^${version}`,
    },
    devDependencies: {
      typescript,
    },
  };

  return {
    data,
    path: "package.json",
    print: inspect(data, false, 5, true),
  };
}

export const tsConfig = {
  path: "tsconfig.json",
  data: {
    compilerOptions: {
      esModuleInterop: true,
      lib: ["ES2020"],
      moduleResolution: "node",
      resolveJsonModule: true,
      rootDir: ".",
      strict: false,
      target: "ES2020",
    },
    include: ["**/*.ts"],
  },
};

export const gitIgnore = {
  path: ".gitignore",
  data: `# Ignore node_modules and Pepr build artifacts
node_modules
dist
insecure*
`,
};

export const prettierRC = {
  path: ".prettierrc",
  data: {
    arrowParens: "avoid",
    bracketSameLine: false,
    bracketSpacing: true,
    embeddedLanguageFormatting: "auto",
    insertPragma: false,
    printWidth: 80,
    quoteProps: "as-needed",
    requirePragma: false,
    semi: true,
    tabWidth: 2,
    useTabs: false,
  },
};

export const readme = {
  path: "README.md",
  data: `# Pepr Module

This is a Pepr module. It is a module that can be used with the [Pepr]() framework.

The \`capabilities\` directory contains all the capabilities for this module. By default, 
a capability is a single typescript file in the format of \`capability-name.ts\` that is 
imported in the root \`pepr.ts\` file as \`import { HelloPepr } from "./capabilities/hello-pepr";\`. 
Because this is typescript, you can organize this however you choose, e.g. creating a sub-folder 
per-capability or common logic in shared files or folders.

Example Structure:

\`\`\`
Module Root
├── package.json
├── pepr.ts
└── capabilities
    ├── example-one.ts
    ├── example-three.ts
    └── example-two.ts
\`\`\`
`,
};

export const samplesYaml = {
  path: "samples.yaml",
  data: dumpYaml([
    {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-demo",
      },
    },
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "example-1",
        namespace: "pepr-demo",
      },
      data: {
        key: "ex-1-val",
      },
    },
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "example-2",
        namespace: "pepr-demo",
      },
      data: {
        key: "ex-2-val",
      },
    },
    {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "example-3",
        namespace: "pepr-demo",
        labels: {
          change: "by-label",
        },
      },
      data: {
        key: "ex-3-val",
      },
    },
  ]),
};

export const helloPeprTS = {
  path: "hello-pepr.ts",
  data: `import { Capability, a } from "pepr";

/**
 *  The HelloPepr is an example capability to demonstrate some general concepts of Pepr.
 *  To test this capability you can run \`pepr dev\` and then run the following command:
 *  \`kubectl apply -f capabilities/hello-pepr/samples.yaml\`
 */ 
export const HelloPepr = new Capability({
  name: "hello-pepr",
  description: "A simple example capability to show how things work.",
  namespaces: ["pepr-demo"],
});

// Use the 'When' function to create a new Capability Action
const { When } = HelloPepr;
  
/**
 * This is a single Capability Action. They can be in the same file or put imported from other files.
 * In this exmaple, when a ConfigMap is created with the name \`example-1\`, then add a label and annotation.
 *
 * Equivelant to manually running:
 * \`kubectl label configmap example-1 pepr=was-here\`
 * \`kubectl annotate configmap example-1 pepr.dev=annotations-work-too\`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-1")
  .Then(request =>
    request
      .SetLabel("pepr", "was-here")
      .SetAnnotation("pepr.dev", "annotations-work-too")
  );

/**
 * This Capabiility Action does the exact same changes for example-2, except this time it uses the \`.ThenSet()\` feature.
 * You can stack multiple \`.Then()\` calls, but only a single \`.ThenSet()\`
 */
When(a.ConfigMap)
  .IsCreated()
  .WithName("example-2")
  .ThenSet({
    metadata: {
      labels: {
        pepr: "was-here",
      },
      annotations: {
        "pepr.dev": "annotations-work-too",
      },
    },
  });

/**
 * This Capability Action combines different styles. Unlike the previous actions, this one will look for any ConfigMap
 * in the \`pepr-demo\` namespace that has the label \`change=by-label\` during either CREATE or UPDATE. Note that all 
 * conditions added such as \`WithName()\`, \`WithLabel()\`, \`InNamespace()\`, are ANDs so all conditions must be true 
 * for the request to be procssed.
 */
When(a.ConfigMap)
  .IsCreatedOrUpdated()
  .WithLabel("change", "by-label")
  .Then(request => {
    // The K8s object e are going to mutate
    const cm = request.Raw;

    // Get the username and uid of the K8s reuest
    const { username, uid } = request.Request.userInfo;

    // Store some data about the request in the configmap
    cm.data["username"] = username;
    cm.data["uid"] = uid;

    // You can still mix other ways of making changes too
    request.SetAnnotation("pepr.dev", "making-waves");
  });    
`,
};

export const snippet = {
  path: "pepr.code-snippets",
  data: `{
  "Create a new Pepr capability": {
    "prefix": "create pepr capability",
    "body": [
      "import { Capability, a } from 'pepr';",
      "",
      "export const $\{TM_FILENAME_BASE/(.*)/$\{1:/pascalcase}/} = new Capability({",
      "\\tname: '$\{TM_FILENAME_BASE}',",
      "\\tdescription: '$\{1:A brief description of this capability.}',",
      "\\tnamespaces: [$\{2:}],",
      "});",
      "",
      "// Use the 'When' function to create a new Capability Action",
      "const { When } = $\{TM_FILENAME_BASE/(.*)/$\{1:/pascalcase}/};",
      "",
      "// When(a.<Kind>).Is<Event>().Then(change => change.<changes>",
      "When($\{3:})"
    ],
    "description": "Creates a new Pepr capability with a specified description, and optional namespaces, and adds a When statement for the specified value."
  }
}`,
};
