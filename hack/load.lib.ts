// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

export function toMs(human: string) {
  const UNITS: Record<string, number> = {};
  UNITS.ms = 1;
  UNITS.s = UNITS.ms * 1000;
  UNITS.m = UNITS.s * 60;
  UNITS.h = UNITS.m * 60;
  UNITS.d = UNITS.h * 24;
  UNITS.w = UNITS.d * 7;
  UNITS.mo = UNITS.d * 30;
  UNITS.y = UNITS.d * 365;

  let splits = human.split("").map(m => m.trim());

  let groups: string[] = [];
  splits.forEach(next => {
    const tail = groups.at(-1) as string;
    const sameKind = (tail: string, next: string) => /\d+/.test(tail) === /\d+/.test(next);
    sameKind(tail, next) ? groups.splice(-1, 1, `${tail}${next}`) : groups.push(next);
  });

  let pairs = groups.reduce<[string, string][]>(
    (acc, cur, idx, arr) => (idx % 2 === 0 ? [...acc, [arr[idx], arr[idx + 1]]] : acc),
    [],
  );

  let parsed = pairs.map<[number, string]>(([num, unit]) => {
    let parsedNum = parseInt(num);
    if (isNaN(parsedNum)) {
      throw `Unrecognized number "${num}" seen while parsing "${human}"`;
    }

    let validUnits = Object.keys(UNITS);
    if (!validUnits.includes(unit)) {
      throw `Unrecognized unit "${unit}" seen while parsing "${human}"`;
    }

    return [parsedNum, unit];
  });

  let milliseconds = parsed.reduce<number>((acc, [num, unit]) => acc + num * UNITS[unit], 0);

  return milliseconds;
}
