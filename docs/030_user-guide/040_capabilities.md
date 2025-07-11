# Pepr Capabilities

A capability is set of related [actions](./030_actions/) that work together to achieve a specific transformation or operation on Kubernetes resources. Capabilities are user-defined and can include one or more actions. They are defined within a Pepr module and can be used in both MutatingWebhookConfigurations and ValidatingWebhookConfigurations. A Capability can have a specific scope, such as mutating or validating, and can be reused in multiple Pepr modules.

When you [`npx pepr init`](./010_pepr-cli.md#pepr-init), a `capabilities` directory is created for you. This directory is where you will define your capabilities. You can create as many capabilities as you need, and each capability can contain one or more actions. Pepr also automatically creates a `HelloPepr` capability with a number of example actions to help you get started.

## Creating a Capability

Defining a new capability can be done via a [VSCode Snippet](https://code.visualstudio.com/docs/editor/userdefinedsnippets) generated during [`npx pepr init`](./010_pepr-cli.md#pepr-init).

1. Create a new file in the `capabilities` directory with the name of your capability. For example, `capabilities/my-capability.ts`.

1. Open the new file in VSCode and type `create` in the file. A suggestion should prompt you to generate the content from there.

[https://user-images.githubusercontent.com/882485/230897379-0bb57dff-9832-479f-8733-79e103703135.mp4](https://user-images.githubusercontent.com/882485/230897379-0bb57dff-9832-479f-8733-79e103703135.mp4)

_If you prefer not to use VSCode, you can also modify or copy the `HelloPepr` capability to meet your needs instead._

## Reusable Capabilities

Pepr has an NPM org managed by Defense Unicorns, `@pepr`, where capabilities are published for reuse in other Pepr Modules. You can find a list of [published capabilities here](https://www.npmjs.com/search?q=@pepr).

You also can publish your own Pepr capabilities to NPM and import them.  A couple of things you'll want to be aware of when publishing your own capabilities:

- Reuseable capability versions should use the format `0.x.x` or `0.12.x` as examples to determine compatibility with other reusable capabilities. Before `1.x.x`, we recommend binding to `0.x.x` if you can for maximum compatibility.

- `pepr.ts` will still be used for local development, but you'll also need to publish an `index.ts` that exports your capabilities. When you build & publish the capability to NPM, you can use `npx pepr build --entry-point index.ts` to generate the code needed for reuse by other Pepr modules.
