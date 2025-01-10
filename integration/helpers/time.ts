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

  const splits = human.split("").map(m => m.trim());

  const groups: string[] = [];
  splits.forEach(next => {
    const tail = groups.at(-1) as string;
    const sameKind = (tail: string, next: string) => /\d+/.test(tail) === /\d+/.test(next);
    sameKind(tail, next) ? groups.splice(-1, 1, `${tail}${next}`) : groups.push(next);
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

export function toHuman(ms: number) {
  const UNITS: Record<string, number> = {};
  UNITS.ms = 1;
  UNITS.s = UNITS.ms * 1000;
  UNITS.m = UNITS.s * 60;
  UNITS.h = UNITS.m * 60;
  UNITS.d = UNITS.h * 24;
  UNITS.w = UNITS.d * 7;
  UNITS.mo = UNITS.d * 30;
  UNITS.y = UNITS.d * 365;

  let y = 0;
  let mo = 0;
  let w = 0;
  let d = 0;
  let h = 0;
  let m = 0;
  let s = 0;
  let remain = ms;

  while (remain >= UNITS.y) {
    remain -= UNITS.y;
    y += 1;
  }
  while (remain >= UNITS.mo) {
    remain -= UNITS.mo;
    mo += 1;
  }
  while (remain >= UNITS.w) {
    remain -= UNITS.w;
    w += 1;
  }
  while (remain >= UNITS.d) {
    remain -= UNITS.d;
    d += 1;
  }
  while (remain >= UNITS.h) {
    remain -= UNITS.h;
    h += 1;
  }
  while (remain >= UNITS.m) {
    remain -= UNITS.m;
    m += 1;
  }
  while (remain >= UNITS.s) {
    remain -= UNITS.s;
    s += 1;
  }

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
