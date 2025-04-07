// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import { CustomResourceDefinition } from "../../src/cli/crd/generate";
import yaml from "js-yaml";


const FILE = path.basename(__filename);
const HERE = __dirname;
let crd = ""
let crdJSON: CustomResourceDefinition;
describe("crd", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);
  
  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("60s"));

  describe("creates TypeScript types", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;

    const group = "cache";
    const version = "v1alpha1";
    const kind = "Memcached";
    const domain = "pepr.dev";
    const scope = "Namespaced";
    const plural = "memcacheds";
    const shortName = "mc";
    const tsTypesFilePath = path.join(workdir.path(), "api", version, `${kind.toLocaleLowerCase()}_types.ts`);
    const crdFilePath = path.join(workdir.path(), "crds",`${kind.toLocaleLowerCase()}.yaml`);
    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--group ${group}`,
        `--version ${version}`,
        `--kind ${kind}`,
        `--shortName ${shortName}`,
        `--plural ${plural}`,
        `--scope ${scope}`,
        `--domain ${domain}`,
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr crd create ${argz}` });
      await pepr.cli(workdir.path(), { cmd: `pepr crd generate` });
    }, time.toMs("2m"));

    describe("npx pepr api create - creates TypeScript types", () => {
      it("creates a new CRD TypeScript definition at api/<group>/<kind>_types.ts", async () => {
        try {
          await fs.access(tsTypesFilePath);
          expect(true).toBe(true);
        } catch (err) {
          expect(err).toBeFalsy();
        }
      });
    });

    describe("npx pepr api generate - generates a CRD from TypeScript types", () => {
      it("creates a new CRD at crds/<kind>.yaml", async () => {
        try {
          await fs.access(crdFilePath);
          crd = await fs.readFile(crdFilePath, "utf8");
          crdJSON = yaml.load(crd) as CustomResourceDefinition;
          expect(true).toBe(true);
          expect(crdJSON).toBeDefined();
          expect(crd).toBeDefined();
        } catch (err) {
          expect(err).toBeFalsy();
        }
      });
    });

    it("should produce CRD with accurate metadata", () => {
      expect(crdJSON.metadata.name).toEqual(`${plural}.${group}.pepr.dev`);
    });

    it("should produce CRD with accurate top level spec", ()=> {
      expect(crdJSON.spec.group).toEqual(`${group}.pepr.dev`);
      expect(crdJSON.spec.names.kind).toEqual(kind);
      expect(crdJSON.spec.names.plural).toEqual(plural);
      expect(crdJSON.spec.names.singular).toEqual(kind.toLowerCase());
      expect(crdJSON.spec.names.shortNames).toEqual([shortName]);
      expect(crdJSON.spec.scope).toEqual(scope);
    })

    it("should produce CRD with accurate spec versions", () => {
      expect(crdJSON.spec.versions[0].name).toEqual(version);
      expect(crdJSON.spec.versions[0].served).toEqual(true);
      expect(crdJSON.spec.versions[0].storage).toEqual(true);
    })

    it("should produce CRD with accurate spec versions schema", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.description).toEqual("MemcachedSpec defines the desired state of Memcached");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties).toBeDefined();
    });

    it("should produce CRD with size property based on TypeScript Type with size", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.size).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.size.type).toEqual("array");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.size.items!.type).toEqual("number");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.size.description).toEqual("Size defines the number of Memcache instances");
    })

    it("should produce CRD with size property based on TypeScript Type with containerPort", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.containerPort).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.containerPort.type).toEqual("number");
    })

    it("should produce CRD with containerPort property based on TypeScript Type with config", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.language).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.language.type).toEqual("array");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.language.items!.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.timezone).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.timezone.type).toEqual("number");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.description).toEqual("Application specific configuration");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties!.state).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties!.state.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties!.areaCode).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties!.areaCode.type).toEqual("array");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.properties!.areaCode.items!.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.properties!.zone.required).toEqual(["state", "areaCode"]);
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties.config.required).toEqual(["language", "timezone", "zone"]);
    });

    it("should container correct required fields for spec", () =>{
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.spec.required).toEqual(["containerPort"]);
    })

    it("should produce CRD with accurate top level status", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.description).toEqual("MemcachedStatus defines the observed state of Memcached");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties).toBeDefined();
    })

    it("should produce CRD with accurate status conditions", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.type).toEqual("array");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.description).toEqual("Condition contains details for one aspect of the current state of this API Resource.");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties).toBeDefined();
    });

    it("should produce CRD with accurate status conditions lastTransitionTime", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.lastTransitionTime).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.lastTransitionTime.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.lastTransitionTime.format).toEqual("date-time");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.lastTransitionTime.description).toContain("lastTransitionTime is the last time the condition transitioned from one status to another. This is not guaranteed to be set in happensBefore order across different conditions for a given object. It may be unset in some circumstances.");
    });

    it("should produce CRD with accurate status conditions message", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.message).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.message.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.message.description).toContain("message is a human readable message indicating details about the transition. This may be an empty string.");
    })

    it("should produce CRD with accurate status conditions observedGeneration", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.observedGeneration).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.observedGeneration.type).toEqual("number");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.observedGeneration.description).toContain("observedGeneration represents the .metadata.generation that the condition was set based upon.");
    })

    it("should produce CRD with accurate status conditions reason", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.reason).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.reason.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.reason.description).toContain("reason contains a programmatic identifier indicating the reason for the condition's last transition.")
      
    })

    it("should produce CRD with accurate status conditions status", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.status).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.status.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.status.description).toContain("status of the condition, one of True, False, Unknown.");
    })

    it("should produce CRD with accurate status conditions vm", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.type).toEqual("object");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.description).toContain("VM location.");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.name).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.name.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.region).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.region.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.status).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.status.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.message).toBeDefined();
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.properties!.message.type).toEqual("string");
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.properties.vm.required).toEqual(["name", "region", "status", "message"]);

    })

    it("should produce CRD with accurate required fields for status", () => {
      expect(crdJSON.spec.versions[0].schema.openAPIV3Schema.properties.status.properties.conditions.items!.required).toStrictEqual(["lastTransitionTime", "message", "reason", "status", "vm"]);

    })

  });

});
        // Not optional, subresource must be present and it is empty
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
