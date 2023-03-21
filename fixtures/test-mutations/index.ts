import { a } from "@k8s";
import { Capability } from "@pepr";
import { changeABunchOfDeploymentThings } from "./change-a-bunch-of-deployment-things";
import { modifyCronJobSchedule } from "./modify-cron-job-schedule";

const { When } = new Capability({
  name: "mutation-tests",
  description: "A collection of examples of data mutations.",
  namespaces: ["mutation-namespace"],
});

When(a.CronJob).IsCreated().Then(modifyCronJobSchedule);

When(a.Deployment).IsDeleted().Then(changeABunchOfDeploymentThings);
