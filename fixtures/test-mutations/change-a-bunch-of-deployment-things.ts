import { Deployment } from "@k8s-types";
import { Action } from "@pepr";

export function changeABunchOfDeploymentThings(deployment: Action<Deployment>) {
  deployment
    .SetLabel("mutated", "true")
    .SetLabel("test", "thing")
    .SetAnnotation("test2", "thing")
    .RemoveLabel("test3");

  if (deployment.HasLabel("test")) {
    deployment.SetLabel("test5", "thing");
  }

  let { spec } = deployment.Raw;
  spec.strategy.type = "Recreate";
  spec.minReadySeconds = 3;

  if (deployment.PermitSideEffects) {
    // Do side-effect inducing things
  }
}
