import { AdmissionRequest } from "@k8s";
import Pepr from "@pepr";

let c = new Pepr.Capability({
  name: "mutation-tests",
  description: "A collection of examples of resource mutations.",
  namespaces: ["mutation-namespace"],
});

// separate function (could be in a different file)
c.When("pod").From("core/v1").IsCreated().Mutate(mutatePod);

c.When("v1.Pod").IsCreated().Mutate(mutatePod);

c.When("v1/Pod").IsCreated().Mutate(mutatePod);

c.When("core.v1.Pod").IsCreated().Mutate(mutatePod);

c.When("core/v1/Pod").IsCreated().Mutate(mutatePod);

c.OnCreate("pod").From("core/v1").Mutate(mutatePod);

c.OnCreate("v1.Pod").Mutate(mutatePod);

c.OnCreate("v1/Pod").Mutate(mutatePod);

c.OnCreate("core.v1.Pod").Mutate(mutatePod);

c.OnCreate("core/v1/Pod").Mutate(mutatePod);

function mutatePod(resource: AdmissionRequest) {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
}

// inline function
c.When("pod")
  .From("core/v1")
  .IsCreated()
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.When("v1.Pod")
  .IsCreated()
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.When("v1/Pod")
  .IsCreated()
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.When("core.v1.Pod")
  .IsCreated()
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.When("core/v1/Pod")
  .IsCreated()
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.OnCreate("pod")
  .From("core/v1")
  .Mutate((resource) => {
    resource.object.metadata.labels["mutated"] = "true";
    return resource;
  });

c.OnCreate("v1.Pod").Mutate((resource) => {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
});

c.OnCreate("v1/Pod").Mutate((resource) => {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
});

c.OnCreate("core.v1.Pod").Mutate((resource) => {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
});

c.OnCreate("core/v1/Pod").Mutate((resource) => {
  resource.object.metadata.labels["mutated"] = "true";
  return resource;
});
