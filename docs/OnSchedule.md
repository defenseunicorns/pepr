# OnSchedule

The `OnSchedule` feature allows you to schedule and automate the execution of specific code at predefined intervals or schedules. This feature is designed to simplify recurring tasks and can serve as an alternative to traditional CronJobs. This code is designed to be run at the top level on a Capability, not within a function like `When`.
  
> **Note -** To use this feature in dev node `npx pepr dev`, you MUST set `PEPR_WATCH_MODE="true"`. This is because the scheduler only runs in the watch controller not started in dev mode by default. `PEPR_WATCH_MODE="true" npx pepr dev`
  
## Usage

Create a schedule by calling the OnSchedule function with the following parameters:

**name** - The unique name of the schedule.

**every** - (Optional) An integer that represents the frequency of the schedule.

**unit** - (Optional) A string specifying the time unit for the schedule (e.g., `seconds`, `minute`, `minutes`, `hour`, `hours`).  

**startTime** - (Optional) A UTC timestamp indicating when the schedule should start. All date times must be provided in GMT.  

**run** - A function that contains the code you want to execute on the defined schedule.  

**completions** - (Optional) An integer indicating the maximum number of times the schedule should run.


## Examples

Update the curr ConfigMap every 15 seconds and use the store to track the current count:

```typescript
let curr = 0 
OnSchedule({
    name: "hello-pepr",
    every: 15,
    unit: "seconds",
    run: async () => {
      Log.info("Wait 15 seconds and create/update a cm");
      curr++;
  
      try {
        await K8s(kind.ConfigMap).Apply({
          metadata: {
            name: "current-interation",
            namespace: "default",
          },
          data: {
            count: `${curr}`,
          },
        });
        Store.setItem("currentCount", `${curr}`);
      } catch (error) {
        // You can use the Log object to log messages to the Pepr controller pod
        Log.error(error, "Failed to apply ConfigMap using server-side apply.");
      }
    },
  });
```

Every 24 hours refresh the AWSToken, start in 30 seconds, and only run 3 times:

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

## Considerations

- Ensure that all date times are provided in GMT to maintain consistent scheduling.
- Review your scheduling needs to determine if OnSchedule is suitable for your use case compared to traditional CronJobs.
- OnSchedule waits for the store to be ready before executing because the schedule is stored in etcd. This means that if the store is not ready, the schedule will not run.
