---
title: OnSchedule
linkTitle: OnSchedule
---

# OnSchedule

The `OnSchedule` feature allows you to schedule and automate the execution of specific code at predefined intervals or schedules. This feature is designed to simplify recurring tasks and can serve as an alternative to traditional CronJobs. This code is designed to be run at the top level on a Capability, not within a function like `When`.


## Usage

Create a schedule by calling the OnSchedule function with the following parameters:

**every** - (Optional) An integer that represents the frequency of the schedule.

**unit** - (Optional) A string specifying the time unit for the schedule (e.g., `seconds`, `minute`, `minutes`, `hour`, `hours`).  

**startTime** - (Optional) A UTC timestamp indicating when the schedule should start. All date times must be provided in GMT.  

**run** - A function that contains the code you want to execute on the defined schedule.  

**completions** - (Optional) An integer indicating the maximum number of times the schedule should run.


## Examples

Run something once tomorrow at this time:

```typescript
const currentDate = new Date();

const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours * 60 minutes * 60 seconds * 1000 milliseconds
const tomorrowAtThisTime = new Date(currentDate.getTime() + oneDayInMilliseconds);

console.log(futureDate);

OnSchedule({
  startTime: tomorrowAtThisTime,
  run: () => {
     console.log("I created this yesterday")
  },
  completions: 1,
});
```

Update Token every 20 hours:

```typescript
OnSchedule({
  every: 20,
  unit: "hours",
  run: () => {
     UpdateAWSToken();
  },
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
