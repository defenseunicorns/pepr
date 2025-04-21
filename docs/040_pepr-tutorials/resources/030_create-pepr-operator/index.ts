import { Capability, a, Log } from "pepr";
import { WebApp } from "./crd";
import { validator } from "./crd/validator";
import { WebAppCRD } from "./crd/source/webapp.crd";
import { RegisterCRD } from "./crd/register";
import { reconciler } from "./reconciler";
import "./crd/register";
import Deploy from "./controller/generators";

export const WebAppController = new Capability({
  name: "webapp-controller",
  description: "A Kubernetes Operator that manages WebApps",
  namespaces: [],
});

const { When, Store } = WebAppController;

// When instance is created or updated, validate it and enqueue it for processing
When(WebApp)
  .IsCreatedOrUpdated()
  .Validate(validator)
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata.name, JSON.stringify(instance));
      await reconciler(instance);
    } catch (error) {
      Log.info(`Error reconciling instance of WebApp`);
    }
  });

// Remove the instance from the store BEFORE it is deleted so reconcile stops
// and a cascading deletion occurs for all owned resources.
// To make this work, we extended the timeout on the WebHook Configuration
When(WebApp)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata.name);
  });

// Don't let the CRD get deleted
When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName(WebAppCRD.metadata.name)
  .Watch(() => {
    RegisterCRD();
  });

// Don't let them be deleted
When(a.Deployment)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async deploy => {
    const instance = JSON.parse(
      Store.getItem(deploy.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
When(a.Service)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async svc => {
    const instance = JSON.parse(
      Store.getItem(svc.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
When(a.ConfigMap)
  .IsDeleted()
  .WithLabel("pepr.dev/operator")
  .Watch(async cm => {
    const instance = JSON.parse(
      Store.getItem(cm.metadata!.labels["pepr.dev/operator"]),
    ) as a.GenericKind;
    await Deploy(instance);
  });
