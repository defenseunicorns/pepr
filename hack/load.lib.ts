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

interface PodResourceRange {
  cpu: [number, number];
  mem: [number, number];
}

type Trend = "increasing" | "decreasing" | "random";

export function generateAudienceData(
  trend: Trend = "random",
  samples: number = 10,
  start: number = Date.UTC(2020, 12, 25),
  interval: number = toMs("1m"),
  ranges: {
    admis: PodResourceRange;
    watch: PodResourceRange;
  } = {
    admis: { cpu: [2, 50], mem: [100, 300] },
    watch: { cpu: [20, 500], mem: [300, 900] },
  },
): string[] {
  const module = "pepr-pepr-uuid";
  const admisRepSet = `${module}-aaaa0bbbb`;
  const watchRepSet = `${module}-watcher-ccccccccc`;

  const pods = [`${admisRepSet}-aaaaa`, `${admisRepSet}-bbbbb`, `${watchRepSet}-ccccc`];

  const timing = (start: number, interval: number, sampleNum: number) =>
    start + interval * sampleNum;

  const cpus = (min: number, max: number, trend: Trend) => {
    switch (trend) {
      case "increasing":
        throw "not impl'd";

      case "decreasing":
        throw "not impl'd";

      case "random":
        return Math.floor(Math.random() * (max - min) + min)
          .toString()
          .concat("m");

      default:
        throw "you shouldn't be here";
    }
  };

  const mems = (min: number, max: number, trend: Trend) => {
    switch (trend) {
      case "increasing":
        throw "not impl'd";

      case "decreasing":
        throw "not impl'd";

      case "random":
        return Math.floor(Math.random() * (max - min) + min)
          .toString()
          .concat("Mi");

      default:
        throw "you shouldn't be here";
    }
  };

  const rowTemplate = `{18:timestamp}\t{name:41} {cpu:5} {mem:8}`;

  const numRows = pods.length * samples;
  let auds: string[] = Array.from({ length: numRows }, (val, idx) => {
    const sampleNum = Math.floor(idx / pods.length);
    const timestamp = timing(start, interval, sampleNum).toString();
    const podName = pods[idx % pods.length];
    const range = podName.includes("watcher") ? ranges.watch : ranges.admis;
    const cpu = cpus(range.cpu[0], range.cpu[1], trend);
    const mem = mems(range.mem[0], range.mem[1], trend);

    let row = rowTemplate;

    let [match, width] = rowTemplate.match(/\{(\d+):timestamp\}/)!;
    row = row.replace(match, timestamp.padStart(Number(width), " "));

    [match, width] = rowTemplate.match(/\{name:(\d+)\}/)!;
    row = row.replace(match, podName.padEnd(Number(width), " "));

    [match, width] = rowTemplate.match(/\{cpu:(\d+)\}/)!;
    row = row.replace(match, cpu.padEnd(Number(width), " "));

    [match, width] = rowTemplate.match(/\{mem:(\d+)\}/)!;
    row = row.replace(match, mem.padEnd(Number(width), " "));

    return row;
  });

  return auds;
}

export function parseAudienceData(logs: string) {
  const lines = logs.split("\n");
  let parsed: Record<string, { ts: string; cpu: string; mem: string }[]> = {};
  for (let line of lines) {
    let [ts, rest] = line.split("\t").map(m => m.trim());
    let [name, cpu, mem] = rest.split(/\s+/).map(m => m.trim());

    Object.hasOwn(parsed, name)
      ? parsed[name].push({ ts, cpu, mem })
      : (parsed[name] = [{ ts, cpu, mem }]);
  }
  return parsed;
}
