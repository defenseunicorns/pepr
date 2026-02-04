import { Assets } from "../../lib/assets/assets";
import { deployWebhook } from "../../lib/assets/deploy";
import { loadCapabilities } from "../../lib/assets/loader";
import { namespaceDeploymentsReady } from "../../lib/deploymentChecks";
import { namespaceComplianceValidator, validateCapabilityNames } from "../../lib/helpers";
import { CapabilityExport } from "../../lib/types";
import { buildModule } from "../build/buildModule";

export async function buildAndDeployModule(image: string, force: boolean): Promise<void> {
  const builtModule = await buildModule("dist", {});
  if (!builtModule) {
    return;
  }

  // Generate a secret for the module
  const webhook = new Assets(
    { ...builtModule.cfg.pepr, description: builtModule.cfg.description },
    builtModule.path,
    [],
  );
  webhook.image = image ?? webhook.image;
  const capabilities = await loadCapabilities(webhook.path);
  for (const capability of capabilities) {
    validateNamespaces(capability, webhook);
  }
  try {
    await webhook.deploy(deployWebhook, force, builtModule.cfg.pepr.webhookTimeout ?? 10);

    // wait for capabilities to be loaded and test names
    validateCapabilityNames(webhook.capabilities);

    // Wait for the pepr-system resources to be fully up
    await namespaceDeploymentsReady();
    console.info(`Module deployed successfully`);
  } catch (e) {
    console.error(`Error deploying module:`, e);
    process.exit(1);
  }
}
export function validateNamespaces(capability: CapabilityExport, webhook: Assets): void {
  namespaceComplianceValidator(capability, webhook.alwaysIgnore?.namespaces);
  namespaceComplianceValidator(
    capability,
    webhook.config.admission?.alwaysIgnore?.namespaces,
    false,
  );
  namespaceComplianceValidator(capability, webhook.config.watch?.alwaysIgnore?.namespaces, true);
}
