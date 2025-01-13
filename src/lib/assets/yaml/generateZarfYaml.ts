import { dumpYaml } from "@kubernetes/client-node";
import { ModuleConfig } from "../../core/module";

export function generateZarfYaml(name: string, image: string, config: ModuleConfig, path: string): string {
  const zarfCfg = {
    kind: "ZarfPackageConfig",
    metadata: {
      name,
      description: `Pepr Module: ${config.description}`,
      url: "https://github.com/defenseunicorns/pepr",
      version: `${config.appVersion || "0.0.1"}`,
    },
    components: [
      {
        name: "module",
        required: true,
        manifests: [
          {
            name: "module",
            namespace: "pepr-system",
            files: [path],
          },
        ],
        images: [image],
      },
    ],
  };

  return dumpYaml(zarfCfg, { noRefs: true });
}
