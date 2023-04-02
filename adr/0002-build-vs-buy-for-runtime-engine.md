# 2. Not using JSPolicy and building our own solution

Date: 2023-04-01

## Context

Our project required a Kubernetes policy engine solution to enforce security, compliance, and operational best practices. We considered using JSPolicy, a JavaScript and TypeScript-based solution, but ultimately decided against it due to various concerns and limitations.

## Decision

We decided not to use JSPolicy and instead build our own policy engine solution.

### Reasons for not using JSPolicy

1. **Project inactivity**: JSPolicy appears to have limited activity and has not received significant updates or improvements since its inception.
2. **Development practices**: The project's development practices include incorporating their own products into the repo, which can make it difficult to use and maintain.
3. **Documentation**: The developer documentation is not comprehensive and can be challenging to follow.
4. **Licensing and ownership concerns**: The project is licensed under Apache 2, but there were concerns about potential community fragmentation if the original company picked it up again.
5. **Codebase organization**: The codebase appears to be challenging to maintain and could benefit from better organization.
6. **Lack of airgapped support**: JSPolicy does not support airgapped environments with npm dependencies.
7. **Untapped potential**: The project could further leverage the JavaScript and TypeScript ecosystems to create a more optimal user experience.
8. **Focus on optimization and security**: JSPolicy does not prioritize hook optimization or security as much as we require.
9. **Communication with maintainers**: We reached out to the project maintainers for updates, but received limited response.

### Benefits of building our own solution

1. **Full control**: We have complete control over the solution, allowing us to tailor it to our specific needs and requirements.
2. **No licensing or ownership concerns**: By building our own solution, we eliminate any concerns about licensing or ownership.
3. **Elegant developer experience**: We can focus on creating a fluent interface for an enjoyable and efficient developer experience.
4. **Holistic solution**: Our custom solution will be more cohesive, rather than a collection of disparate tools.
5. **Better support for Zarf**: Our solution will have improved support for Zarf, further enhancing our project.
6. **Performance tuning**: We can optimize our solution for performance and efficiency.
7. **Enhanced security**: We can easily add signing and security features to our custom solution.

## Status

Accepted

## Consequences

- We will invest time and resources in building our own policy engine solution.
- Our custom solution will be tailored to our needs and requirements, improving the overall project.
- We will not have to worry about licensing, ownership, or fragmentation issues that could arise from using JSPolicy.
- Our developers will benefit from an elegant and efficient development experience.
- We will assume the responsibility of maintaining and updating our custom solution.
