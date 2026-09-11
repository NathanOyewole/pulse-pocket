import { describe, expect, it } from "vitest";
import {
  ALERT_REPEAT_TTL_MS,
  MAX_ALERTS_PER_RUN,
  formatPriceUsd,
  planNotifications,
  spikeAlertBody,
  spikeAlertTitle,
  type NotifiedMap,
} from "../spikeAlerts";
import type { Spike, TokenPairSnapshot } from "../types";

function makeSpike(pairAddress: string, symbol: string, magnitude: number): Spike {
  const snapshot: TokenPairSnapshot = {
    pairAddress,
    baseSymbol: symbol,
    baseMint: `${symbol.toLowerCase()}mint`,
    quoteSymbol: "SOL",
    quoteMint: "sol-mint",
    priceUsd: 0.0042,
    volumeH1: 500000,
    volumeH24: 1200000,
    priceChangeH1: 0,
    priceChangeH24: 0,
    liquidityUsd: 80000,
    imageUrl: null,
    fetchedAt: Date.now(),
  };
  return {
    pairAddress,
    baseSymbol: symbol,
    quoteSymbol: "SOL",
    kind: "volume",
    magnitude,
    currentSnapshot: snapshot,
    baselineVolumeH1: 120000,
    detectedAt: Date.now(),
  };
}

describe("planNotifications", () => {
  it("returns fresh spikes once, deduped by pair", () => {
    const spikes = [makeSpike("a", "AAA", 4), makeSpike("b", "BBB", 3)];
    const { toNotify, next } = planNotifications(spikes, {}, 1_000_000);
    expect(toNotify.map((s) => s.pairAddress)).toEqual(["a", "b"]);
    expect(next).toEqual({ a: 1_000_000, b: 1_000_000 });
  });

  it("does not re-alert a pair that was notified recently", () => {
    const spikes = [makeSpike("a", "AAA", 4)];
    const notified: NotifiedMap = { a: 1_000_000 };
    const { toNotify } = planNotifications(spikes, notified, 1_000_000 + 60_000);
    expect(toNotify).toHaveLength(0);
  });

  it("re-alerts a pair whose quiet period has elapsed", () => {
    const spikes = [makeSpike("a", "AAA", 4)];
    const notified: NotifiedMap = { a: 1_000_000 };
    const { toNotify, next } = planNotifications(
      spikes,
      notified,
      1_000_000 + ALERT_REPEAT_TTL_MS + 1
    );
    expect(toNotify.map((s) => s.pairAddress)).toEqual(["a"]);
    expect(next.a).toBe(1_000_000 + ALERT_REPEAT_TTL_MS + 1);
  });

  it("prunes stale entries so the map never grows unbounded", () => {
    const spikes: Spike[] = [];
    const notified: NotifiedMap = { zed: 1 };
    const { next } = planNotifications(spikes, notified, 1_000_000 + ALERT_REPEAT_TTL_MS + 1);
    expect(next).toEqual({});
  });

  it("caps alerts per run to avoid a notification explosion", () => {
    const spikes = Array.from({ length: 20 }, (_, i) =>
      makeSpike(`p${i}`, `T${i}`, 5)
    );
    const { toNotify, next } = planNotifications(spikes, {}, 1_000_000);
    expect(toNotify).toHaveLength(MAX_ALERTS_PER_RUN);
    // Capped pairs count as alerted so they won't immediately fire next run.
    expect(Object.keys(next)).toHaveLength(MAX_ALERTS_PER_RUN);
  });
});

describe("alert copy", () => {
  it("formats prices compactly", () => {
    expect(formatPriceUsd(1.2345)).toBe("$1.2345");
    expect(formatPriceUsd(0.0000042)).toBe("$0.000004");
    expect(formatPriceUsd(0)).toBe("$0");
  });

  it("builds a readable volume nudge", () => {
    expect(spikeAlertBody(makeSpike("a", "AAA", 4.25))).toContain("4.3x baseline");
    expect(spikeAlertBody(makeSpike("a", "AAA", 4.25))).toContain("$0.004200");
  });

  it("titles an alert with the symbol pair", () => {
    expect(spikeAlertTitle(makeSpike("a", "AAA", 4))).toBe("PULSE · AAA/SOL");
  });
});