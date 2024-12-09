# Roadmap for Pepr 
_2024 Roadmap_  
## Phase 1: Preparation - Testing and Docs

- **Q1**:
  - **Establish Medium for Communication with Community**:
    - Establish communication channel for community members and contributors. Easy/discoverable "how to contribute" guide.
  - **Site/Documentation**:
    - Improve information architecture, nail killer use-cases, and make it obvious how to get started and find your way around.
  - **Automated Testing**:
    - Focus on stories that increase confidence in protection of features and functionality. Simplify hello-pepr and bring e2e test against external repo with examples. Make sure that contributions are well-tested.

## Phase 2: Community Building, Competitive Analysis, Instrumentation and Feature Development

- **Q2**:
  - **Community Engagement**:
    - Begin engaging with potential contributors and users through social media, Kubernetes/Cloud Native Computing Foundation (CNCF) meetups, and other channels. Monitor and participate in our Slack channel.
  - **Feature Development**:
    - Based on company feedback, continuously improve and add features. Add feature parity with other tools in the Kubernetes ecosystem where it makes sense. Chip away at the backlog.
  - **Documentation Improvements**:
    - Continue to improve documentation and add more examples like Doom, find scaling limitations
  - **Competitive Analysis**:
    - Understand the competitive landscape and how/where Pepr can/does differentiate itself. Have it in the docs.
  - **Instrumentation**:
    - Outfit Pepr with the necessary instrumentation to collect metrics and logs. Use this data to make informed about the watch direction.

## Phase 3: Informer Iterations, Watch Analysis, Metric Collection, Development/Stabilization/Improvement of New Features

- **Q3**:
  - **Informer Iterations**:
    - Tune informer based on feedback from UDS Core and delivery so events will be reconciled through eventual consistency.
    - [Evaluate](https://github.com/defenseunicorns/pepr/blob/main/adr/0015-kfc-watch-undici.md) other underlying technologies for informer.
  - **Feature Development**:
    - `.WithNameRegex()/.InNamespaceRegex()` for Kubernetes Controller development against resources that could match a variety of names or namespaces.
    - `.WithDeletionTimestamp()` for Kubernetes Controller Development against resources that are pending deletion
    - Create a sharded queue that enables the Module Author to define queueing strategies based on `kind`, `kind/namespace`, `kind/namespace/name`, `global`.
  - **Community Building**:
    - Grow the contributor base, establish a governance model, and encourage community-led initiatives. Look to drive conversation in our Slack Channel.
    - Based on community feedback, continuously improve and add features. Rigoursly test and document and review code.
  - **Project Advocation**:
    - Publicly advocate for the project and encourage adoption.
  - **Stability**:
    - Ensure that the project is stable and reliable. Make sure that the project is well-tested and documented.
    - Identify new areas of project improvement and work on them.

## Phase 4: Feature Development, Stablization, Code and Testing Quality Improvements

- **Q4**:
  - **Features**:
    - Improve DevEx overrides in Pepr section of package.json for customized builds of Modules
    - `.Finalize()` for Kubernetes Controller Development to controlling downstream resources through finalizers
    - Scaffolding to validate images from a registry through cosign/sigstore
    - Replace node-fetch with Undici in the KFC project for performance improvements
  - **Removal of Circular Dependencies**:
    Identify and remove circular dependencies in the codebase.
  - **Strong Typings**:
    - Identify where we can make Pepr/KFC stronger by adding typings.
  - **Work to reduce code complexity**
    - Monitor code complexity through eslint, work to drive down complexity
  - **Robust E2E Tests in KFC**:
    - Create a strong e2e suite in KFC, ensure tests are robust and cover all the features of KFC.
  - **Documentation**:
    - Ensure that the documentation is up-to-date and accurate. Add more examples and use-cases.
    - Onboarding and contribution guides should be clear and easy to follow.
  - **Load/Stress Testing**:
    - Load test Pepr/KFC to identify bottlenecks and areas of improvement.
    - Ensure that Pepr/KFC can handle a large number of resources and events over a sustained period of time (nightly).

_2025 Roadmap_  
## Phase 1: Code Quality - Experimentation 

- **Q1**:
  - **Turn on eslint enforcement and configure settings and see no warnings**:
    - Eliminate circular dependencies, complexity, return statements, etc.
  - **Metric and Performance Baselining**:
    - Establish a baseline for performance and resource utilization metrics. Use this data to make informed decisions about the direction of the project in terms of Deno2
  - **Experimentation with Deno2**:
    - Experiment with Deno2 through Dash Days and see if it can be used in the project. Look into the performance improvements and new features that Deno2 brings to the table. Attempt to back the PeprStore through a Valkey Cache.
  - **OTEL Preparation**:
    - Come up with a plan to implement Open Telemetry. Specifically distributed tracing, metrics, logs and events. Use this data to make debugging easier from a UDS Core prespective. There will be documentation work on how to use an OTEL collector with a Pepr Module.

## Phase 2: Durable Storage for Metrics and Performance Tests / Transactional Pepr Store

- **Q2**:
  - **Professional Dashboard displaying metrics and performance tests originating from CI**:
    - Begin engaging with potential contributors and users through social media, Kubernetes/Cloud Native Computing Foundation (CNCF) meetups, and other channels. Monitor and participate in our Slack channel.
  - **Transactional Pepr Store Planning and Implementation**:
   - Sus out details involved with having a transactional Pepr Store. What are the implications of this? What are the benefits? What are the drawbacks? What are the use-cases? What are the technologies that can be used to implement this?
  - **Deno2**:
    - Depending on Q1, make a decision of whether or not to go with Deno2. If so, begin the migration process.


## Phase 3: TBD

- **Q3**:

## Phase 4: TDB

- **Q4**:

