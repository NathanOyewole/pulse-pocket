import { describe, expect, it } from "vitest";
import {
  DIGEST_MAX_MOVERS,
  MOVERS_LOG_MAX,
  MOVERS_LOG_TTL_MS,
  appendMovers,
  computeDigest,
  dayKey,
  shouldShowDigest,
  startOfLocalDay,
  type Digest,
  type MoverEntry,
} from "../digest";
import type { Narrative } from "../types";

function makeNarrative(
  pairAddress: string,
  symbol: string,
  magnitude: number,
  generatedAt: number
): Narrative {
  return {
    id: `n-${pairAddress}-${generatedAt}`,
    spike: {
      pairAddress,
      baseSymbol: symbol,
      quoteSymbol: "SOL",
      kind: "price",
      magnitude,
      currentSnapshot: {
        pairAddress,
        baseSymbol: symbol,
        baseMint: `${symbol.toLowerCase()}mint`,
        quoteSymbol: "SOL",
        quoteMint: "sol-mint",
        priceUsd: 0.5,
        volumeH1: 1000,
        volumeH24: 5000,
        priceChangeH1: 0,
        priceChangeH24: magnitude,
        liquidityUsd: 50000,
        imageUrl: null,
        fetchedAt: generatedAt,
      },
      baselineVolumeH1: 500,
      detectedAt: generatedAt,
    },
    headline: `${symbol}/SOL ${magnitude}%`,
    blurb: "test",
    generatedAt,
  };
}

function makeEntry(
  pairAddress: string,
  symbol: string,
  magnitude: number,
  ts: number
): MoverEntry {
  return {
    pairAddress,
    baseSymbol: symbol,
    quoteSymbol: "SOL",
    priceChangeH24: magnitude,
    imageUrl: null,
    headline: `${symbol}/SOL`,
    kind: "price",
    magnitude,
    ts,
  };
}

const NOW = new Date(2026, 8, 20, 9, 0, 0).getTime(); // Sep 20 2026 09:00 local
const TODAY_START = startOfLocalDay(NOW);

describe("appendMovers", () => {
  it("appends new pairs and sorts newest-first", () => {
    const a = makeNarrative("a", "AAA", 10, NOW - 60_000);
    const b = makeNarrative("b", "BBB", 20, NOW - 30_000);
    const out = appendMovers([], [a, b], NOW);
    expect(out.map((e) => e.pairAddress)).toEqual(["b", "a"]);
  });

  it("replaces an existing pair's entry (freshest wins), no duplicates", () => {
    const older = makeNarrative("a", "AAA", 10, NOW - 60_000);
    const newer = makeNarrative("a", "AAA", 30, NOW - 10_000);
    const merged = appendMovers(
      appendMovers([], [older], NOW),
      [newer],
      NOW
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].magnitude).toBe(30);
  });

  it("drops entries older than the TTL", () => {
    const stale = makeEntry("stale", "OLD", 9, NOW - MOVERS_LOG_TTL_MS - 1);
    const fresh = makeEntry("fresh", "NEW", 9, NOW - 1000);
    const out = appendMovers([stale, fresh], [], NOW);
    expect(out.map((e) => e.pairAddress)).toEqual(["fresh"]);
  });

  it("caps the log at MOVERS_LOG_MAX", () => {
    const entries = Array.from({ length: MOVERS_LOG_MAX + 10 }, (_, i) =>
      makeEntry(`p${i}`, `S${i}`, 5, NOW - i * 1000)
    );
    const out = appendMovers(entries, [], NOW);
    expect(out.length).toBe(MOVERS_LOG_MAX);
  });
});

describe("computeDigest", () => {
  it("returns null when nothing moved since local midnight", () => {
    const yesterday = makeEntry("a", "AAA", 10, TODAY_START - 1000);
    expect(computeDigest([yesterday], NOW)).toBeNull();
  });

  it("summarizes today's movers, one per pair, strongest first, capped", () => {
    const movers = Array.from({ length: DIGEST_MAX_MOVERS + 3 }, (_, i) =>
      makeEntry(`p${i}`, `S${i}`, i * 10, TODAY_START + i * 60_000)
    );
    const digest = computeDigest(movers, NOW);
    expect(digest).not.toBeNull();
    expect(digest!.movers).toHaveLength(DIGEST_MAX_MOVERS);
    // strongest first => descending magnitude (index 0 = P(N+2) with biggest)
    for (let i = 1; i < digest!.movers.length; i++) {
      expect(Math.abs(digest!.movers[i - 1].magnitude)).toBeGreaterThanOrEqual(
        Math.abs(digest!.movers[i].magnitude)
      );
    }
  });

  it("marks the digest with the local day key", () => {
    const entry = makeEntry("a", "AAA", 10, TODAY_START + 60_000);
    const digest = computeDigest([entry], NOW);
    expect(digest!.day).toBe(dayKey(NOW));
  });

  it("does not include pre-midnight entries in the mover list", () => {
    const before = makeEntry("a", "AAA", 99, TODAY_START - 1000);
    const after = makeEntry("b", "BBB", 10, TODAY_START + 10_000);
    const digest = computeDigest([before, after], NOW);
    expect(digest!.movers.map((m) => m.pairAddress)).toEqual(["b"]);
  });
});

describe("shouldShowDigest", () => {
  const digest: Digest = { day: "2026-09-20", movers: [] };

  it("shows when the day has not been seen yet", () => {
    expect(shouldShowDigest(null, digest)).toBe(true);
    expect(shouldShowDigest("2026-09-19", digest)).toBe(true);
  });

  it("hides when the day was already shown", () => {
    expect(shouldShowDigest("2026-09-20", digest)).toBe(false);
  });

  it("hides when there is no digest", () => {
    expect(shouldShowDigest(null, null)).toBe(false);
  });
});