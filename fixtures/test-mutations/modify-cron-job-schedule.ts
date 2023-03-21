import { CronJob } from "@k8s-types";
import { Action } from "@pepr";

export function modifyCronJobSchedule(cronJob: Action<CronJob>) {
  cronJob.Raw.spec.schedule = "*/5 * * * *";
}
