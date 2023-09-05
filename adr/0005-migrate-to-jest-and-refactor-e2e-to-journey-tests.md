# 5: Migrate to Jest and Refactor E2E Tests to Journey Tests

Date: 2023-09-03

## Status

Accepted

## Context

We initially used [Ava](https://github.com/avajs/ava), [Sinon](https://github.com/sinonjs/sinon), [TSX](https://github.com/esbuild-kit/tsx), and [nyc](https://github.com/istanbuljs/nyc) for our unit and "e2e" testing in a TypeScript environment. However, we encountered multiple issues:

- Mocking was cumbersome and had limitations.
- `beforeEach` and `afterEach` hooks in Ava didn't work as expected with Sinon reset, causing flakiness in tests.
- When mocking was finally working, the setup with `tsx` was not compatible with Node 20.
- Difficulty in mocking tended to lead to more e2e tests than unit tests or avoiding tests altogether.
- Our e2e tests were not truly end-to-end, but rather were journey tests focusing on specific user journeys.

## Decision

We decided to:

1. Migrate from Ava/Sinon/NYC to [Jest](https://jestjs.io/) for both unit and journey testing.
2. Refactor and rename our existing "e2e tests" to journey tests.
3. Optimize for more unit tests to cover edge cases and journey tests to cover user journeys.

### Why Jest?

1. **Simpler Mocking**: Jest provides built-in mocking, simplifying test setup and teardown.
2. **Coverage Support**: Jest comes with built-in code coverage support.
3. **TypeScript Support**: Jest works well with TypeScript, although we needed to include `ts-jest` for complete TypeScript support. This contrasts with Ava, which required `tsx` that caused issues with Node.js 20.
4. **Node Version Compatibility**: Jest tests run smoothly on both Node.js versions 18 and 20.
5. **Community and Ecosystem**: Jest has a large community and a rich ecosystem of plugins and extensions.

### Why Refactor to Journey Tests?

1. **Test Organization**: The tests were refactored from a single monolithic file into a well-organized structure leveraging Jest's `describe` and `it` blocks.
2. **Test Semantics**: The term 'journey tests' better describes the scope and intention of these tests, focusing on user journeys through specific use-cases.

## Consequences

1. **Developer Experience**: Improved developer experience due to simpler test setup, better mocking, and excellent Node.js compatibility.
2. **Test Stability**: Increased stability and reliability of tests.
3. **Learning Curve**: Team members will need to familiarize themselves with Jest and the new test structure.
4. **Code Churn**: Existing tests were rewritten and refactored to adapt to Jest's syntax and mocking capabilities.
5. **Documentation**: Existing documentation will need to be updated to reflect these changes.
