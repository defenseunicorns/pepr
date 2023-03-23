import { a } from "@k8s";
import { Capability } from "@pepr";
import { changeABunchOfDeploymentThings } from "./change-a-bunch-of-deployment-things";
import { modifyCronJobSchedule } from "./modify-cron-job-schedule";

const { When, Register } = new Capability({
  name: "test-mutations",
  description: "A collection of examples of data mutations.",
  namespaces: ["mutation-namespace"],
});

export default Register;

When(a.CronJob)
  .IsCreated()
  .WithLabel("changeme", "true")
  .WithAnnotation("changeme", "true")
  .Then(modifyCronJobSchedule);

When(a.Deployment).IsCreatedOrUpdated().Then(changeABunchOfDeploymentThings);
