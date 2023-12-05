// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import { PeprValidateRequest } from "./validate-request";
import { a } from "../lib";
import { containers } from "./module-helpers";

test("should return a list of containers in the pod", async () => {
  const standardContainers = [
    {
      name: "container-1",
    },
  ];
  const initContainers = [
    {
      name: "init-container-1",
    },
  ];
  const ephemeralContainers = [
    {
      name: "ephemeral-container-1",
    },
  ];
  const allContainers = [...standardContainers, ...initContainers, ...ephemeralContainers];
  const peprValidationRequest = {
    Raw: {
      spec: {
        containers: standardContainers,
        initContainers,
        ephemeralContainers,
      },
    },
  } as PeprValidateRequest<a.Pod>;

  let result = containers(peprValidationRequest);
  expect(result).toEqual(expect.arrayContaining(allContainers));
  expect(result).toHaveLength(allContainers.length);

  result = containers(peprValidationRequest, "containers");
  expect(result).toEqual(expect.arrayContaining(standardContainers));
  expect(result).toHaveLength(standardContainers.length);

  result = containers(peprValidationRequest, "initContainers");
  expect(result).toEqual(expect.arrayContaining(initContainers));
  expect(result).toHaveLength(initContainers.length);

  result = containers(peprValidationRequest, "ephemeralContainers");
  expect(result).toEqual(expect.arrayContaining(ephemeralContainers));
  expect(result).toHaveLength(ephemeralContainers.length);
});
