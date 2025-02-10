# OnSchedule

The `OnSchedule` feature allows you to schedule and automate the execution of specific code at predefined intervals or schedules. This feature is designed to simplify recurring tasks and can serve as an alternative to traditional CronJobs. This code is designed to be run at the top level on a Capability, not within a function like `When`.

## Best Practices

`OnSchedule` is designed for targeting intervals equal to or larger than 30 seconds due to the storage mechanism used to archive schedule info.

## Usage

Create a recurring task execution by calling the OnSchedule function with the following parameters:

**name** - The unique name of the schedule.

**every** - An integer that represents the frequency of the schedule in number of _units_.

**unit** - A string specifying the time unit for the schedule (e.g., `seconds`, `minute`, `minutes`, `hour`, `hours`).

**startTime** - (Optional) A UTC timestamp indicating when the schedule should start. All date times must be provided in GMT. If not specified the schedule will start when the schedule store reports ready.

**run** - A function that contains the code you want to execute on the defined schedule.

**completions** - (Optional) An integer indicating the maximum number of times the schedule should run to completion. If not specified the schedule will run indefinitely.

## Examples

Update a ConfigMap every 30 seconds:

```typescript
OnSchedule({
    name: "hello-interval",
    every: 30,
    unit: "seconds",
    run: async () => {
      Log.info("Wait 30 seconds and create/update a ConfigMap");

      try {
        await K8s(kind.ConfigMap).Apply({
          metadata: {
            name: "last-updated",
            namespace: "default",
          },
          data: {
            count: `${new Date()}`,
          },
        });

      } catch (error) {
        Log.error(error, "Failed to apply ConfigMap using server-side apply.");
      }
    },
  });
```

Refresh an AWSToken every 24 hours, with a delayed start of 30 seconds, running a total of 3 times:

```typescript

OnSchedule({
  name: "refresh-aws-token",
  every: 24,
  unit: "hours",
  startTime: new Date(new Date().getTime() + 1000 * 30),
  run: async () => {
    await RefreshAWSToken();
  },
  completions: 3,
});
```

## Advantages

- Simplifies scheduling recurring tasks without the need for complex CronJob configurations.
- Provides flexibility to define schedules in a human-readable format.
- Allows you to execute code with precision at specified intervals.
- Supports limiting the number of schedule completions for finite tasks.
