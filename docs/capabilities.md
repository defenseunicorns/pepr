# Capabilities

A capability is set of related [CapabilityActions](./actions.md) that work together to achieve a specific transformation or operation on Kubernetes resources. Capabilities are user-defined and can include one or more CapabilityActions. They are defined within a Pepr module and can be used in both MutatingWebhookConfigurations and ValidatingWebhookConfigurations. A Capability can have a specific scope, such as mutating or validating, and can be reused in multiple Pepr modules.

When you [`pepr init`](./cli.md#pepr-init), a `capabilities` directory is created for you. This directory is where you will define your capabilities. You can create as many capabilities as you need, and each capability can contain one or more CapabilityActions. Pepr also automatically creates a `HelloPepr` capability with a number of example CapabilityActions to help you get started.

## Creating a Capability

Define a new capability can be done via a [VSCode Snippet](https://code.visualstudio.com/docs/editor/userdefinedsnippets) generated during [`pepr init`](./cli.md#pepr-init).

1. Create a new file in the `capabilities` directory with the name of your capability. For example, `capabilities/my-capability.ts`.

1. Open the new file in VSCode and type `create` in the file. A suggestion should prompt you to generate the content from there.

https://user-images.githubusercontent.com/882485/230897379-0bb57dff-9832-479f-8733-79e103703135.mp4

_If you prefer not to use VSCode, you can also modify or copy the `HelloPepr` capability to meet your needs instead._
