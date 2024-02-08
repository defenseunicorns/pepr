// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { parseTimeout } from "./build";
import { expect, describe, it } from "@jest/globals";
import * as commander from 'commander';

describe('parseTimeout', () => {
    const PREV = 'a';
  it('should return a number when a valid string number between 1 and 30 is provided', () => {
    expect(parseTimeout('5', PREV)).toBe(5);
    expect(parseTimeout('1', PREV)).toBe(1);
    expect(parseTimeout('30', PREV)).toBe(30);
  });

  it('should throw an InvalidArgumentError for non-numeric strings', () => {
    expect(() => parseTimeout('abc', PREV)).toThrow(commander.InvalidArgumentError);
    expect(() => parseTimeout('', PREV)).toThrow(commander.InvalidArgumentError);
  });

  it('should throw an InvalidArgumentError for numbers outside the 1-30 range', () => {
    expect(() => parseTimeout('0', PREV)).toThrow(commander.InvalidArgumentError);
    expect(() => parseTimeout('31', PREV)).toThrow(commander.InvalidArgumentError);
  });

  it('should throw an InvalidArgumentError for numeric strings that represent floating point numbers', () => {
    expect(() => parseTimeout('5.5', PREV)).toThrow(commander.InvalidArgumentError);
    expect(() => parseTimeout('20.1', PREV)).toThrow(commander.InvalidArgumentError);
  });
});
