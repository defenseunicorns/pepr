import { kind as a } from "@k8s";
import Pepr from "@pepr";

const { When } = new Pepr.Capability({
  name: "mutation-tests",
  description: "A collection of examples of resource mutations.",
  namespaces: ["mutation-namespace"],
});

When(a.CronJob).IsCreated().Run(mutateCronJob);

When(a.Deployment).IsUpdated().Run(mutatePod);

When(a.Deployment).IsDeleted().Run(mutatePod);

When({
  group: "source.toolkit.fluxcd.io",
  version: "v1beta1",
  kind: "GitRepository",
})
  .IsCreated()
  .Run(mutatePod);

function mutateCronJob(resource) {
  resource.object.spec.schedule = "*/5 * * * *";
  return resource;
}

function mutatePod(resource) {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
}
