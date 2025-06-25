import { dumpYaml } from "@kubernetes/client-node";
import { Assets } from "../assets";

type ConfigType = "manifests" | "charts";

export function generateZarfYamlGeneric(assets: Assets, path: string, type: ConfigType): string {
  const zarfComponentName = process.env.PEPR_CUSTOM_BUILD_NAME ?? "module";
  const manifestSettings = {
    name: zarfComponentName,
    namespace: "pepr-system",
    files: [path],
  };
  const chartSettings = {
    name: zarfComponentName,
    namespace: "pepr-system",
    version: `${assets.config.appVersion || "0.0.1"}`,
    localPath: path,
  };

  const component = {
    name: zarfComponentName,
    required: true,
    images: [assets.image],
    [type]: [type === "manifests" ? manifestSettings : chartSettings],
  };

  const zarfCfg = {
    kind: "ZarfPackageConfig",
    metadata: {
      name: assets.name,
      description: `Pepr Module: ${assets.config.description}`,
      url: "https://github.com/defenseunicorns/pepr",
      version: `${assets.config.appVersion || "0.0.1"}`,
    },
    components: [component],
  };

  return dumpYaml(zarfCfg, { noRefs: true });
}
