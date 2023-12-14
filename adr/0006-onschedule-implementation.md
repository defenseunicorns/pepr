# 6: OnSchedule Implementation

Date: 2023-10-16

## Status

Accepted

## Context

Zarf wrote a Pepr module to facilitate the development in [using ECR as an external registry during 'Zarf Init'](https://github.com/defenseunicorns/zarf/issues/1594). They are running into a challenge where the ECR Registry token is expiring every ~12 hours. Currently, they are having to maintain two completely different codebases, one being the Pepr module that communicates with AWS, and another being a Go app that they run as a `CronJob` to refresh the token. They are interested in rewriting the Go and scheduling logic in Pepr.

We considered a few options:
- setTimeout - Pepr is created with DevEx being a first class citizen and using a setTimeout doesn't cover persistence and stylistically different than the fluent API.
- setInterval - " " 
- using a `CronJob` - Forces the user to create a separate container image and maintain two codebases while they already have Pepr which should be able to handle this.
- Use the crontab API - Provide a crontab string to run at the given time. Too big, didn't want to implement at this point.
- Use the `OnSchedule` API - Provide a fluent API to run at the given time, with a completions argument.

## Decision

```typescript
OnSchedule({
  every: 5,
  unit: "minutes",
  startTime: "2023-10-16T00:00:00Z", // all dates times must be in GMT
  run: () => {
     // run some code
  },
  completions: 5,
});
```

We decided to:

Use `OnSchedule` to provide a fluent API to run at the given time, with a completions argument in the event that it needs to `RunAt` some given time and stop. This allows us to cover the functionality that something needs to be run on startup only once, like an IIFE.

### Missed Jobs

On missed (cluster restart, power outage) jobs we will run the code at the next scheduled interval and not count the failure against completions.

### Why watch controller?

The watch controller runs a single instance, this means we can avoid multiple controllers competing to run the same code.

### Why `OnSchedule`?

1. **Covers CronJob usecase**: We can cover the repeatability of a kubernetes native `CronJob` using `OnSchedule` to allow Zarf team to consoludate this functionlity into Pepr.
2. **Backed by etcd**: We can mitigate the risk of Pepr being down by using etcd as the backing store for the `OnSchedule` API and warn the user that these `jobs` should be idempotent.


## Consequences

1. **Developer Experience**: Improved developer experience by extending the functionality provided in Pepr. Reduce the need to maintain a separate codebase to accomplish scheduled `job` type operations.
2. **Test Stability**: Need to extend the internal tests to cover `OnSchedule`.
3. **Documentation**: Existing documentation will need to be updated to reflect these changes.
