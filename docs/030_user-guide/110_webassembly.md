# WASM Support

Pepr fully supports WebAssembly. Depending on the language used to generate the WASM, certain files can be too large to fit into a `Secret` or `ConfigMap`. Due to this limitation, users have the ability to incorporate `*.wasm` and any other essential files during the build phase, which are then embedded into the Pepr Controller container. This is achieved through adding an array of files to the `includedFiles` section under `pepr` in the `package.json`.

> **NOTE -** In order to instantiate the WebAsembly module in TypeScript, you need the WebAssembly type. This is accomplished through add the "DOM" to the `lib` array in the `compilerOptions` section of the `tsconfig.json`. Ex: `"lib": ["ES2022", "DOM"]`. Be aware that adding the DOM will add a lot of extra types to your project and your developer experience will be impacted in terms of the intellisense.

## High-Level Overview

WASM support is achieved through adding files as layers atop the Pepr controller image, these files are then able to be read by the individual capabilities. The key components of WASM support are:

- Add files to the **base** of the Pepr module.
- Reference the files in the `includedFiles` section of the `pepr` block of the `package.json`
- Run `npx pepr build` with the `--registry-info` option specifying registry info. Ex: `npx pepr build --registry-info docker.io/cmwylie19`
- Pepr builds and pushes a custom image that is used in the `Deployment`.

## Using WASM Support

### Creating a WASM Module in Go

Create a simple Go function that you want to call from your Pepr module

```go
package main

import (
 "fmt"
 "syscall/js"
)

func concats(this js.Value, args []js.Value) interface{} {
    fmt.Println("PeprWASM!")
 stringOne := args[0].String()
 stringTwo := args[1].String()
 return fmt.Sprintf("%s%s", stringOne, stringTwo)
}

func main() {
 done := make(chan struct{}, 0)
 js.Global().Set("concats", js.FuncOf(concats))
 <-done
}
```

Compile it to a wasm target and move it to your Pepr module

```bash
GOOS=js GOARCH=wasm go build -o main.wasm
cp main.wasm $YOUR_PEPR_MODULE/
```

Copy the `wasm_exec.js` from `GOROOT` to your Pepr Module

```bash
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" $YOUR_PEPR_MODULE/
```

Update the polyfill to add `globalThis.crypto` in the `wasm_exec.js` since we are not running in the browser. This is needed directly under: `(() => {`

```javascript
// Initialize the polyfill
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
        getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        },
    };
}
```

### Configure Pepr to use WASM

After adding the files to the root of the Pepr module, reference those files in the `package.json`:

```json
{
  "name": "pepr-test-module",
  "version": "0.0.1",
  "description": "A test module for Pepr",
  "keywords": [
    "pepr",
    "k8s",
    "policy-engine",
    "pepr-module",
    "security"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "pepr": {
    "name": "pepr-test-module",
    "uuid": "static-test",
    "onError": "ignore",
    "alwaysIgnore": {
      "namespaces": [],
      "labels": []
    },
    "includedFiles":[
      "main.wasm",
      "wasm_exec.js"
    ]
  },
  ...
}
```

Update the `tsconfig.json` to add "DOM" to the `compilerOptions` lib:

```json
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "esModuleInterop": true,
    "lib": [
      "ES2022",
      "DOM" // <- Add this
    ],
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "resolveJsonModule": true,
    "rootDir": ".",
    "strict": false,
    "target": "ES2022",
    "useUnknownInCatchVariables": false
  },
  "include": [
    "**/*.ts"
  ]
}
```

### Call WASM functions from TypeScript

Import the `wasm_exec.js` in the `pepr.ts`

```javascript
import "./wasm_exec.js";
```

Create a helper function to load the wasm file in a capability and call it during an event of your choice

```typescript
async function callWASM(a,b) {
  const go = new globalThis.Go();

  const wasmData = readFileSync("main.wasm");
  var concated: string;

  await WebAssembly.instantiate(wasmData, go.importObject).then(wasmModule => {
    go.run(wasmModule.instance);

    concated = global.concats(a,b);
  });
  return concated;
}

When(a.Pod)
.IsCreated()
.Mutate(async pod => {
  try {
    let label_value = await callWASM("loves","wasm")
    pod.SetLabel("pepr",label_value)
  }
  catch(err) {
    Log.error(err);
  }
});
```

### Run Pepr Build

Build your Pepr module with the registry specified.

```bash
npx pepr build --registry-info docker.io/defenseunicorns
```
