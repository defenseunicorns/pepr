// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, beforeEach, afterEach, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as f from "node:fs";
import { Workdir } from "../helpers/workdir";
import * as sut from "./resource";
import { kind } from "kubernetes-fluent-client";
import os from "os";

const FILE = path.basename(__filename);
const HERE = __dirname;
const FIXTURES = path.join(HERE, "fixtures");
const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/helpers`);

beforeAll(async () => {
  await workdir.recreate();
});

describe("fromFile", () => {
  it("can load one resource from .json file", async () => {
    const dest = `${workdir.path()}/one.json`;
    await fs.copyFile(path.join(FIXTURES, "one.json"), dest);
    const result = await sut.fromFile(dest);
    expect(result.one).toBe("json");
  });

  it("can load one resource from .yaml file", async () => {
    const dest = `${workdir.path()}/one.yaml`;
    await fs.copyFile(path.join(FIXTURES, "one.yaml"), dest);
    const result = await sut.fromFile(dest);
    expect(result.one).toBe("yaml");
  });
});

describe("fromFile", () => {
  it("can load many resources from .json file", async () => {
    const dest = `${workdir.path()}/many.json`;
    await fs.copyFile(path.join(FIXTURES, "many.json"), dest);
    const result = await sut.fromFile(dest);
    expect(result.at(0).one).toBe("json");
    expect(result.at(1).two).toBe("json");
    expect(result.at(2).three).toBe("json");
  });

  it("can load many resources from .yaml file", async () => {
    const dest = `${workdir.path()}/many.yaml`;
    await fs.copyFile(path.join(FIXTURES, "many.yaml"), dest);
    const result = await sut.fromFile(dest);
    expect(result.at(0).one).toBe("yaml");
    expect(result.at(1).two).toBe("yaml");
    expect(result.at(2).three).toBe("yaml");
  });
});

describe("select", () => {
  it("returns typed resources, selected from list by name", async () => {
    const dest = `${workdir.path()}/select.yaml`;
    await fs.copyFile(path.join(FIXTURES, "select.yaml"), dest);
    const many = await sut.fromFile(dest);

    const sec = sut.select(many, kind.Secret, "sec");
    const cm = sut.select(many, kind.ConfigMap, "cm");

    expect(sec.stringData!.top).toBe("secret");
    expect(cm.data!.fake).toBe("news");
  });
});

const mockYaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pepr:agent
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  key: value
`;

describe("getK8sObjectByKindAndName with real file", () => {
  let tempFilePath: string;

  beforeEach(() => {
    const tmpDir = f.mkdtempSync(path.join(os.tmpdir(), "k8s-test-"));
    tempFilePath = path.join(tmpDir, "resources.yaml");
    f.writeFileSync(tempFilePath, mockYaml, "utf8");
  });

  afterEach(() => {
    if (f.existsSync(tempFilePath)) {
      f.unlinkSync(tempFilePath);
      f.rmdirSync(path.dirname(tempFilePath));
    }
  });

  it("finds a ClusterRole by kind and name", () => {
    const result = sut.getK8sObjectByKindAndName<kind.ClusterRole>(
      tempFilePath,
      "ClusterRole",
      "pepr:agent",
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("ClusterRole");
    expect(result?.metadata?.name).toBe("pepr:agent");
    expect(result?.rules?.[0].resources).toContain("pods");
  });

  it("returns null if the kind is incorrect", () => {
    const result = sut.getK8sObjectByKindAndName<kind.ClusterRole>(
      tempFilePath,
      "Role",
      "pepr:agent",
    );

    expect(result).toBeNull();
  });

  it("returns null if the name is incorrect", () => {
    const result = sut.getK8sObjectByKindAndName<kind.ClusterRole>(
      tempFilePath,
      "ClusterRole",
      "not-a-match",
    );

    expect(result).toBeNull();
  });
});
