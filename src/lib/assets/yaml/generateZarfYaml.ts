import { dumpYaml } from "@kubernetes/client-node";
import { ModuleConfig } from "../../core/module";

type ConfigType = "manifests" | "charts";

export function generateZarfYamlGeneric(
  name: string,
  image: string,
  config: ModuleConfig,
  path: string,
  type: ConfigType,
): string {
  const manifestSettings = {
    name: "module",
    namespace: "pepr-system",
    files: [path],
  };
  const chartSettings = {
    name: "module",
    namespace: "pepr-system",
    version: `${config.appVersion || "0.0.1"}`,
    localPath: path,
  };

  const component = {
    name: "module",
    required: true,
    images: [image],
    [type]: [type === "manifests" ? manifestSettings : chartSettings],
  };

  const zarfCfg = {
    kind: "ZarfPackageConfig",
    metadata: {
      name,
      description: `Pepr Module: ${config.description}`,
      url: "https://github.com/defenseunicorns/pepr",
      version: `${config.appVersion || "0.0.1"}`,
    },
    components: [component],
  };

  return dumpYaml(zarfCfg, { noRefs: true });
}
