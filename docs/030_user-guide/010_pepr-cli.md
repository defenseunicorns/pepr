# Pepr CLI

- [Pepr CLI](#pepr-cli)
  - [`npx pepr init`](#npx-pepr-init)
  - [`npx pepr update`](#npx-pepr-update)
  - [`npx pepr dev`](#npx-pepr-dev)
  - [`npx pepr deploy`](#npx-pepr-deploy)
  - [`npx pepr monitor`](#npx-pepr-monitor)
  - [`npx pepr uuid`](#npx-pepr-uuid)
  - [`npx pepr build`](#npx-pepr-build)
  - [`npx pepr kfc`](#npx-pepr-kfc)

## `npx pepr init`

Initialize a new Pepr Module.

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `--skip-post-init` - Skip npm install, git init and VSCode launch

---

## `npx pepr update`

Update the current Pepr Module to the latest SDK version and update the global Pepr CLI to the same version.

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `--skip-template-update` - Skip updating the template files

---

## `npx pepr dev`

Connect a local cluster to a local version of the Pepr Controller to do real-time debugging of your module. Note the `npx pepr dev` assumes a K3d cluster is running by default. If you are working with Kind or another docker-based K8s distro, you will need to pass the `--host host.docker.internal` option to `npx pepr dev`. If working with a remote cluster you will have to give Pepr a host path to your machine that is reachable from the K8s cluster.

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `-h, --host [host]` - Host to listen on (default: "host.k3d.internal")
- `--confirm` - Skip confirmation prompt

---

## `npx pepr deploy`

Deploy the current module into a Kubernetes cluster, useful for CI systems. Not recommended for production use.

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `-i, --image [image]` - Override the image tag
- `--confirm` - Skip confirmation prompt

---

## `npx pepr monitor`

Monitor Validations for a given Pepr Module or all Pepr Modules.

Usage:

```bash
npx pepr monitor [options] [module-uuid]
```

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `-h, --help` - Display help for command

---

## `npx pepr uuid`

Module UUID(s) currently deployed in the cluster with their descriptions.

**Options:**

- `[uuid]` - Specific module UUID

---

## `npx pepr build`

Create a [zarf.yaml](https://zarf.dev) and K8s manifest for the current module. This includes everything needed to deploy Pepr and the current module into production environments.

**Options:**

- `-l, --log-level [level]` - Log level: debug, info, warn, error (default: "info")
- `-e, --entry-point [file]` - Specify the entry point file to build with. (default: "pepr.ts")
- `-n, --no-embed` - Disables embedding of deployment files into output module. Useful when creating library modules intended solely for reuse/distribution via NPM
- `-r, --registry-info [<registry>/<username>]` - Registry Info: Image registry and username. Note: You must be signed into the registry
- `-o, --output-dir [output directory]` - Define where to place build output
- `--timeout [timeout]` - How long the API server should wait for a webhook to respond before treating the call as a failure
- `--rbac-mode [admin|scoped]` - Rbac Mode: admin, scoped (default: admin) (choices: "admin", "scoped", default: "admin")
- `-i, --custom-image [custom-image]` - Custom Image: Use custom image for Admission and Watcher Deployments.
- `--registry [GitHub, Iron Bank]`, - Container registry: Choose container registry for deployment manifests.

## `npx pepr kfc`
Execute a `kubernetes-fluent-client` command. This command is a wrapper around `kubernetes-fluent-client`.

Usage:

```bash
npx pepr kfc [options] [command]
```

If you are unsure of what commands are available, you can run `npx pepr kfc` to see the available commands.

For example, to generate usable types from a Kubernetes CRD, you can run `npx pepr kfc crd [source] [directory]`. This will generate the types for the `[source]` CRD and output the generated types to the `[directory]`.

You can learn more about the `kubernetes-fluent-client` [here](https://github.com/defenseunicorns/kubernetes-fluent-client).
