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

Please follow our [Code of Conduct](./020_code-of-conduct.md) to maintain a respectful and collaborative environment.

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

## Running Tests

### Run Tests Locally

- Run all tests: `npm test`

### Test a Local Development Version

1. Run `npm test` and wait for completion.
2. Change to the test module directory: `cd pepr-test-module`.
3. You can now run any of the `npx pepr` commands.

## Contact

For any questions or concerns, please open an issue on GitHub or contact the maintainers.
