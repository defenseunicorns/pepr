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
  const lines = logs.split("\n").filter(f => f);
  let parsed: Record<string, [number, number, string, number, string][]> = {};
  for (let line of lines) {
    const [ts, rest] = line.split("\t").map(m => m.trim());
    const tsNum = Number(ts);
    const [name, cpu, mem] = rest.split(/\s+/).map(m => m.trim());

    const separate = (measure: string): [number, string] => {
      const num = Number(measure.match(/^[0-9]+/)![0]);
      const unit = measure.match(/[a-zA-Z]+$/)![0];
      return [num, unit];
    };
    const toBytes = ([num, unit]: [number, string]): [number, string] => {
      // https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-memory
      let bytes = 0;
      switch (unit) {
        case "Ki":
          bytes = num * 1024 ** 1;
          break;
        case "Mi":
          bytes = num * 1024 ** 2;
          break;
        case "Gi":
          bytes = num * 1024 ** 3;
          break;
        case "Ti":
          bytes = num * 1024 ** 4;
          break;
        case "Pi":
          bytes = num * 1024 ** 5;
          break;
        case "Ei":
          bytes = num * 1024 ** 6;
          break;
      }
      return [bytes, "B"];
    };
    const [cpuNum, cpuUnit] = separate(cpu);
    const [memNum, memUnit] = toBytes(separate(mem));

    Object.hasOwn(parsed, name)
      ? parsed[name].push([tsNum, cpuNum, cpuUnit, memNum, memUnit])
      : (parsed[name] = [[tsNum, cpuNum, cpuUnit, memNum, memUnit]]);
  }
  return parsed;
}

export function parseActressData(logs: string) {
  const lines = logs.split("\n").filter(f => f);

  let parsed: { load: string; injects: number[] } = { load: "", injects: [] };
  parsed.load = lines.shift()!.replaceAll("\\\\n", "\n");

  for (let line of lines) {
    const ts = line.split("\t").at(0)!.trim();
    const tsNum = Number(ts);
    parsed.injects.push(tsNum);
  }

  return parsed;
}

export namespace Analysis {
  export interface Actress {
    load: string;
    injects: number;
  }

  export interface Measureable {
    start: number;
    min: number;
    max: number;
    end: number;
  }

  export interface Target {
    name: string;
    samples: number;
    cpu: Measureable;
    mem: Measureable;
  }

  export interface Audience {
    targets: Target[];
  }

  export interface Summary {
    actress: Actress;
    audience: Audience;
  }
}

export function injectsToRps(injects: number[]): [number, number][] {
  let rps = injects.map<[number, number]>((val, idx, arr) => {
    // look backward to find injects within prior second
    const pertinent: number[] = [];
    for (let i = idx; i >= 0; i--) {
      const candidate = arr[i];
      if (val - candidate > 1000) {
        break;
      }
      pertinent.push(candidate);
    }
    return [val, pertinent.length];
  });

  return rps;
}
