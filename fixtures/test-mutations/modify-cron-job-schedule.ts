import { CronJob } from "@k8s-types";
import { RequestWrapper } from "@pepr";

export function modifyCronJobSchedule(cronJob: RequestWrapper<CronJob>) {
  cronJob.Raw.spec.schedule = "*/5 * * * *";
}
