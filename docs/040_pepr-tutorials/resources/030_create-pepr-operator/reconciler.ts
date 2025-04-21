import { K8s, Log, sdk } from "pepr";
import Deploy from "./controller/generators";
import { Phase, Status, WebApp } from "./crd";

const { writeEvent } = sdk;

/**
 * The reconciler is called from the queue and is responsible for reconciling the state of the instance
 * with the cluster. This includes creating the namespace, network policies and virtual services.
 *
 * @param pkg the package to reconcile
 */
export async function reconciler(instance: WebApp) {
  if (!instance.metadata?.namespace) {
    Log.error(instance, `Invalid WebApp definition`);
    return;
  }

  const isPending = instance.status?.phase === Phase.Pending;
  const isCurrentGeneration = instance.metadata.generation === instance.status?.observedGeneration;

  if (isPending || isCurrentGeneration) {
    Log.debug(instance, `Skipping pending or completed instance`);
    return;
  }

  const { namespace, name } = instance.metadata;

  Log.debug(instance, `Processing instance ${namespace}/${name}`);

  // Configure the namespace and namespace-wide network policies
  try {
    await updateStatus(instance, { phase: Phase.Pending });

    await Deploy(instance);

    await updateStatus(instance, {
      phase: Phase.Ready,
      observedGeneration: instance.metadata.generation,
    });
  } catch (e) {
    Log.error(e, `Error configuring for ${namespace}/${name}`);
    void updateStatus(instance, {
      phase: Phase.Failed,
      observedGeneration: instance.metadata.generation,
    });
  }
}

/**
 * Updates the status of the instance
 *
 * @param instance The instance to update
 * @param status The new status
 */
async function updateStatus(instance: WebApp, status: Status) {
  await writeEvent(
    instance,
    { phase: status },
    {
      eventType: "Normal",
      eventReason: "CreatedOrUpdate",
      reportingComponent: instance.kind,
      reportingInstance: instance.metadata.name,
    },
  );

  await K8s(WebApp).PatchStatus({
    metadata: {
      name: instance.metadata!.name,
      namespace: instance.metadata!.namespace,
    },
    status,
  });
}
