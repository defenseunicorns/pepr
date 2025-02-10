# Contributor Guide

Thank you for your interest in contributing to Pepr! We welcome all contributions and are grateful for your help. This guide outlines how to get started with contributing to this project.

## Table of Contents

- [Contributor Guide](#contributor-guide)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Setup](#setup)
  - [Submitting a Pull Request](#submitting-a-pull-request)
    - [PR Requirements](#pr-requirements)
  - [Coding Guidelines](#coding-guidelines)
  - [Running Tests](#running-tests)
    - [Run Tests Locally](#run-tests-locally)
    - [Test a Local Development Version](#test-a-local-development-version)
  - [Contact](#contact)

## Code of Conduct

Please follow our [Code of Conduct](../../CODE_OF_CONDUCT.md) to maintain a respectful and collaborative environment.

## Getting Started

- **Repository**: [https://github.com/defenseunicorns/pepr/](https://github.com/defenseunicorns/pepr/)
- **npm package**: [https://www.npmjs.com/package/pepr](https://www.npmjs.com/package/pepr)
- **Required Node version**: `>=18.0.0`

### Setup

1. Fork the repository.
2. Clone your fork locally: `git clone https://github.com/your-username/pepr.git`.
3. Install dependencies: `npm ci`.
4. Create a new branch for your feature or fix: `git checkout -b my-feature-branch`.

## Submitting a Pull Request

1. **Create an Issue**: For significant changes, please create an issue first, describing the problem or feature proposal. Trivial fixes do not require an issue.
2. **Commit Your Changes**: Make your changes and commit them. All commits must be signed.
3. **Run Tests**: Ensure that your changes pass all tests by running `npm test`.
4. **Push Your Branch**: Push your branch to your fork on GitHub.
5. **Create a Pull Request**: Open a pull request against the `main` branch of the Pepr repository. Please make sure that your PR passes all CI checks.

### PR Requirements

- PRs must be against the `main` branch.
- PRs must pass CI checks.
- All commits must be signed.
- PRs should have a related issue, except for trivial fixes.

## Coding Guidelines

Please follow the coding conventions and style used in the project. Use ESLint and Prettier for linting and formatting:

- Check formatting: `npm run format:check`
- Fix formatting: `npm run format:fix`

### Git Hooks

- This project uses [husky](https://typicode.github.io/husky/) to manage git hooks for pre-commit and pre-push actions.
- pre-commit will automatically run linters so that you don't need to remember to run `npm run format:*` commands
- pre-push will warn you if you've changed lots of lines on a branch and encourage you to optionally present the changes as several smaller PRs to facilitate easier PR reviews.
  - The pre-push hook is an opinionated way of working, and is therefore optional.
  - You can opt-in to using the pre-push hook by setting `PEPR_HOOK_OPT_IN=1` as an environment variable.

## Running Tests

### Run Tests Locally

> [!WARNING]
> Be cautious when creating test cases in `journey/`!**
>
> - Test cases that capture end-to-end/journey behavior are usually stored in [pepr-excellent-examples](https://github.com/defenseunicorns/pepr-excellent-examples) or run as a Github workflow (`.github/workflows`).
> - Journey tests established in `journey/` are from an earlier time in project history.

- Run all tests: `npm test`

### Test a Local Development Version

1. Run `npm test` and wait for completion.
2. Change to the test module directory: `cd pepr-test-module`.
3. You can now run any of the `npx pepr` commands.

### Running Development Version Locally

1. Run `npm run build` to build the package.
2. For running modified pepr, you have two options:

  - Using `npx ts-node ./src/cli.ts init` to run the modified code directly, without installing it locally.
    You'll need to also run `npx link <your_dev_pepr_location>` inside your pepr module, to link to the
    development version of pepr.
  - Install the pre-build package with `npm install pepr-0.0.0-development.tgz`.
    You'll need to re-run the installation after every build, though.

3. Run `npx pepr dev` inside your module's directory to run the modified version of pepr.

> [!TIP]
> Make sure to re-run `npm run build` after you modify any of the pepr source files.

## Contact

For any questions or concerns, please open an issue on GitHub or contact the maintainers.
