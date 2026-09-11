import { describe, expect, it, vi } from "vitest";
import {
  computeBoostDeltas,
  buyerSharePct,
  type BoostCountMap,
} from "../attention";

// attention.ts imports AsyncStorage for the persisted boost snapshot; never
// load the real native module in Node.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

function map(entries: [string, number][]): BoostCountMap {
  return Object.fromEntries(entries);
}

describe("computeBoostDeltas", () => {
  it("returns zeros on the first read so there is nothing to report yet", () => {
    const latest = map([
      ["aaa", 3],
      ["bbb", 1],
    ]);
    expect(computeBoostDeltas(latest, null)).toEqual({ aaa: 0, bbb: 0 });
  });

  it("counts boosts gained since the previous snapshot", () => {
    const latest = map([
      ["aaa", 5],
      ["bbb", 4],
      ["ccc", 2],
    ]);
    const previous = map([
      ["aaa", 2],
      ["bbb", 4],
    ]);
    expect(computeBoostDeltas(latest, previous)).toEqual({
      aaa: 3,
      bbb: 0,
      ccc: 2,
    });
  });

  it("never reports a negative delta (clamps to 0)", () => {
    const latest = map([["aaa", 1]]);
    const previous = map([["aaa", 9]]);
    expect(computeBoostDeltas(latest, previous)).toEqual({ aaa: 0 });
  });

  it("ignores mints that dropped out of the latest snapshot", () => {
    const latest = map([["aaa", 2]]);
    const previous = map([
      ["aaa", 1],
      ["zzz", 100],
    ]);
    expect(computeBoostDeltas(latest, previous)).toEqual({ aaa: 1 });
  });
});

describe("buyerSharePct", () => {
  it("computes buying pressure as a 0-100 share", () => {
    expect(buyerSharePct(600, 400)).toBe(60);
    expect(buyerSharePct(0, 100)).toBe(0);
    expect(buyerSharePct(100, 0)).toBe(100);
  });

  it("returns null when data is missing or activity is zero", () => {
    expect(buyerSharePct(null, 400)).toBeNull();
    expect(buyerSharePct(600, null)).toBeNull();
    expect(buyerSharePct(0, 0)).toBeNull();
  });
});