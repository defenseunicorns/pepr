// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import { heredoc } from "../../src/sdk/heredoc";
import * as sut from "./resource";
import { kind } from "kubernetes-fluent-client";

const FILE = path.basename(__filename);
const HERE = __dirname;
const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/helpers`);

beforeAll(async () => {
  await workdir.recreate();
});

describe("oneFromFile", () => {
  it("can load one resource from .json file", async () => {
    const oneJson = `${workdir.path()}/one.json`;
    await fs.writeFile(
      oneJson,
      heredoc`
      {
        "one": "json"
      }
    `,
    );
    const res = await sut.oneFromFile(oneJson);
    expect(res.one).toBe("json");
  });

  it("can load one resource from .yaml file", async () => {
    const oneYaml = `${workdir.path()}/one.yaml`;
    await fs.writeFile(
      oneYaml,
      heredoc`
      ---
      one: yaml
    `,
    );
    const res = await sut.oneFromFile(oneYaml);
    expect(res.one).toBe("yaml");
  });
});

describe("manyFromFile", () => {
  it("can load many resources from .json file", async () => {
    const manyJson = `${workdir.path()}/many.json`;
    await fs.writeFile(
      manyJson,
      heredoc`
      [
        {
          "one": "json"
        },
        {
          "two": "json"
        },
        {
          "three": "json"
        }
      ]
    `,
    );
    const res = await sut.manyFromFile(manyJson);
    expect(res.at(0).one).toBe("json");
    expect(res.at(1).two).toBe("json");
    expect(res.at(2).three).toBe("json");
  });

  it("can load many resources from .yaml file", async () => {
    const manyYaml = `${workdir.path()}/many.yaml`;
    await fs.writeFile(
      manyYaml,
      heredoc`
      ---
      one: yaml
      ---
      two: yaml
      ---
      three: yaml
    `,
    );
    const res = await sut.manyFromFile(manyYaml);
    expect(res.at(0).one).toBe("yaml");
    expect(res.at(1).two).toBe("yaml");
    expect(res.at(2).three).toBe("yaml");
  });
});

describe("select", () => {
  it("returns typed resources, selected from list by name", async () => {
    const manyYaml = `${workdir.path()}/select.yaml`;
    await fs.writeFile(
      manyYaml,
      heredoc`
      ---
      apiVersion: v1
      kind: Secret
      metadata:
        name: sec
        namespace: select
      stringData:
        top: secret
      ---
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: cm
        namespace: select
      data:
        fake: news
    `,
    );
    const many = await sut.manyFromFile(manyYaml);

    const sec = sut.select(many, kind.Secret, "sec");
    const cm = sut.select(many, kind.ConfigMap, "cm");

    expect(sec.stringData!.top).toBe("secret");
    expect(cm.data!.fake).toBe("news");
  });
});
