# 6: OnSchedule Implementation

Date: 2023-10-16

## Status

Under Review

## Context

Zarf wrote a Pepr module to facilitate the development in [using ECR as an external registry during 'Zarf Init'](https://github.com/defenseunicorns/zarf/issues/1594). They are running into a challenge where the ECR Registry token is expiring every ~12 hours. Currently, they are having to maintain two completely different codebases, one being the Pepr module that communicates with AWS, and another being a go binary that they run as a CronJob to refresh the token. They are interested in consolidating the two codebases, and would like to see if there is a way to implement this functionality in Pepr.

We considered a few options:
- setTimeout - Pepr is created with devex being a first class citizen and using a setTimeout violates the devex principle and fluent api.
- setInterval - " " 
- using a `CronJob` - Forces the user to create a separate container image and maintain two codebases while they already have Pepr which should be able to handle this.
- Extend the fluent api with `RunAt()` - Provide code to run at the given time. There were concerns brought up about clock synchronicity.
- Use the crontab api - Provide a crontab string to run at the given time
- Use the `OnSchedule` api - Provide a fluent api to run at the given time, with a completions argument in the event that it needs to `RunAt` some given time and stop.

## Decision

```typescript
OnSchedule({
  every: 5,
  unit: "minutes",
  run: () => {
     // run some code
  },
  completions: 5,
});
```

We decided to:

Use `OnSchedule` to provide a fluent api to run at the given time, with a completions argument in the event that it needs to `RunAt` some given time and stop.

### Why `OnSchedule`?

1. **Covers CronJob usecase**: We can mimic the kubernetes native `CronJob` API using `OnSchedule` to allow Zarf team to consoludate this functionlity into Pepr.
2. **Covers `RunAt` usecase**: By setting completions to 1, and offloading the timing logic to the developer, we cover the logic for `RunAt` and mitigate the concerns around clock synchronicity.
3. **Backed by etcd**: We can mitigate the risk of Pepr being down by using etcd as the backing store for the `OnSchedule` API and warn the user that these `jobs` should be idempotent.


## Consequences

1. **Developer Experience**: Improved developer experience by extending the functionality provided in Pepr. Reduce the need to maintain a separate codebase to accomplish `job` type operations.
2. **Test Stability**: Need to extend the tests to cover `OnSchedule`.
3. **Documentation**: Existing documentation will need to be updated to reflect these changes.
