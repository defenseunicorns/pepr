// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe } from "@jest/globals";
import { genTLS } from "./tls";

describe("tls", () => {
  test("genTLS should generate a valid TLSOut object", () => {
    const tls = genTLS("test");
    expect(tls).toHaveProperty("ca");
    expect(tls).toHaveProperty("crt");
    expect(tls).toHaveProperty("key");
    expect(tls).toHaveProperty("pem");
    expect(tls.pem).toHaveProperty("ca");
    expect(tls.pem).toHaveProperty("crt");
    expect(tls.pem).toHaveProperty("key");
  });
});
