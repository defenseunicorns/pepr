# 4. Use NPX instead of global CLI install

Date: 2023-06-18

## Status

Accepted

## Context

Pepr requires users to install the CLI globally via npm, and manage the SDK version separately through `pepr update`. This approach has led to issues including permission problems during global installation and inconsistencies between CLI and SDK versions.

While `pepr update` does help with SDK version consistency, the version consistency between the CLI and SDK is not guaranteed. This is because the CLI is installed globally, while the SDK is installed locally. This can lead to issues where the CLI is not compatible with the SDK, or vice versa.

Other tools, like Playwright, utilize `npm init <package-name>` and `npx <package-name> <command>` to ensure consistency and avoid global installation issues. However, further investigation revealed that `npm init` approach is not ideal for Pepr due to the requirement for a separate published package and lack of clarity for new users over simply using `npx`.

## Decision

We will migrate from requiring a global Pepr installation to using `npx` for executing the Pepr CLI. This will ensure that users always execute the correct version of the CLI that is compatible with their local SDK.

The proposed commands for using Pepr will be:

```bash
npx pepr@latest init # @latest is optional
npx pepr build
npx pepr dev
npx pepr ... # Other commands
```

This approach has the following benefits:

1. **Version Consistency**: The CLI and SDK versions are guaranteed to be consistent since both are executed from the local `node_modules`.

1. **Permissions**: By avoiding global installations, users won't face permission issues which are common especially on UNIX based systems.

1. **Simplicity**: Still only one command pattern is required to use Pepr, and users don't need to worry about updating the CLI and SDK separately.

However, the new approach has a slight disadvantage that users would have to prefix `npx` before every Pepr command, which might be considered less clean compared to the global installation approach.

## Consequences

1. **Update Documentation**: All documentation and references to Pepr commands will need to be updated to reflect the use of `npx`.

1. **User Adaptation**: Users might need some time to adapt to the new syntax, especially prefixing commands with `npx`.

## Date

18th June 2023
