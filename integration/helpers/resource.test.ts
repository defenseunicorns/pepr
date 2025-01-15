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

describe("fromFile", () => {
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
    const result = await sut.fromFile(oneJson);
    expect(result.one).toBe("json");
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
    const result = await sut.fromFile(oneYaml);
    expect(result.one).toBe("yaml");
  });
});

describe("fromFile", () => {
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
    const result = await sut.fromFile(manyJson);
    expect(result.at(0).one).toBe("json");
    expect(result.at(1).two).toBe("json");
    expect(result.at(2).three).toBe("json");
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
    const result = await sut.fromFile(manyYaml);
    expect(result.at(0).one).toBe("yaml");
    expect(result.at(1).two).toBe("yaml");
    expect(result.at(2).three).toBe("yaml");
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
    const many = await sut.fromFile(manyYaml);

    const sec = sut.select(many, kind.Secret, "sec");
    const cm = sut.select(many, kind.ConfigMap, "cm");

    expect(sec.stringData!.top).toBe("secret");
    expect(cm.data!.fake).toBe("news");
  });
});
