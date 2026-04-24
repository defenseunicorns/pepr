// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

const UNITS: Record<string, number> = {};
UNITS.ms = 1;
UNITS.s = UNITS.ms * 1000;
UNITS.m = UNITS.s * 60;
UNITS.h = UNITS.m * 60;
UNITS.d = UNITS.h * 24;
UNITS.w = UNITS.d * 7;
UNITS.mo = UNITS.d * 30;
UNITS.y = UNITS.d * 365;

export async function nap(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function toMs(human: string): number {
  const splits = human.split("").map(str => str.trim());

  const groups: string[] = [];
  splits.forEach(next => {
    const tail = groups.at(-1) as string;
    const sameKind = (tail: string, next: string): boolean => /\d+/.test(tail) === /\d+/.test(next);
    if (sameKind(tail, next)) {
      groups.splice(-1, 1, `${tail}${next}`);
    } else {
      groups.push(next);
    }
  });

  const pairs = groups.reduce<[string, string][]>(
    (acc, cur, idx, arr) => (idx % 2 === 0 ? [...acc, [arr[idx], arr[idx + 1]]] : acc),
    [],
  );

  const parsed = pairs.map<[number, string]>(([num, unit]) => {
    const parsedNum = parseInt(num);
    if (isNaN(parsedNum)) {
      throw `Unrecognized number "${num}" seen while parsing "${human}"`;
    }

    const validUnits = Object.keys(UNITS);
    if (!validUnits.includes(unit)) {
      throw `Unrecognized unit "${unit}" seen while parsing "${human}"`;
    }

    return [parsedNum, unit];
  });

  const milliseconds = parsed.reduce<number>((acc, [num, unit]) => acc + num * UNITS[unit], 0);

  return milliseconds;
}

function reduceBy(unit: number, ms: number): [number, number] {
  let remain = ms;
  let result = 0;
  while (remain >= unit) {
    remain -= unit;
    result += 1;
  }
  return [result, remain];
}

export function toHuman(ms: number): string {
  const [y, r1] = reduceBy(UNITS.y, ms);
  const [mo, r2] = reduceBy(UNITS.mo, r1);
  const [w, r3] = reduceBy(UNITS.w, r2);
  const [d, r4] = reduceBy(UNITS.d, r3);
  const [h, r5] = reduceBy(UNITS.h, r4);
  const [m, r6] = reduceBy(UNITS.m, r5);
  const [s, remain] = reduceBy(UNITS.s, r6);

  let result = "";
  result = y > 0 ? `${result}${y}y` : result;
  result = mo > 0 ? `${result}${mo}mo` : result;
  result = w > 0 ? `${result}${w}w` : result;
  result = d > 0 ? `${result}${d}d` : result;
  result = h > 0 ? `${result}${h}h` : result;
  result = m > 0 ? `${result}${m}m` : result;
  result = s > 0 ? `${result}${s}s` : result;
  result = remain > 0 ? `${result}${remain}ms` : result;

  return result;
}
