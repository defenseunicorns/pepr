import { dumpYaml } from "@kubernetes/client-node";
import { Assets } from "../assets";

type ConfigType = "manifests" | "charts";

export function generateZarfYamlGeneric(assets: Assets, path: string, type: ConfigType): string {
  const manifestSettings = {
    name: assets.name,
    namespace: "pepr-system",
    files: [path],
  };
  const chartSettings = {
    name: assets.name,
    namespace: "pepr-system",
    version: `${assets.config.appVersion || "0.0.1"}`,
    localPath: path,
  };

  const component = {
    name: assets.name,
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
