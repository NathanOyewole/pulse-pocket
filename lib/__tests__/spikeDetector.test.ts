import { describe, expect, it, vi } from "vitest";
import type { TokenPairSnapshot } from "../types";
import {
  detectSpikes,
  resetHistory,
  HISTORY_TTL_MS,
  type SnapshotStore,
} from "../spikeDetector";

// spikeDetector imports AsyncStorage as its default store; never load the real
// native module in Node.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

const HISTORY_KEY = "pulsepocket:snapshotHistory";

function makeSnapshot(
  overrides: Partial<TokenPairSnapshot> = {}
): TokenPairSnapshot {
  return {
    pairAddress: "PAIR_1",
    baseSymbol: "TKN",
    baseMint: "Mint1111111111111111111111111111111111111",
    quoteSymbol: "SOL",
    quoteMint: "So11111111111111111111111111111111111111112",
    priceUsd: 0.01,
    volumeH1: 1000,
    volumeH24: 10_000,
    priceChangeH1: 0,
    priceChangeH24: 0,
    liquidityUsd: 100_000,
    imageUrl: null,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function createStore() {
  const map = new Map<string, string>();
  const store: SnapshotStore = {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
  return { store, rawValue: (key: string) => map.get(key) ?? null };
}

describe("detectSpikes", () => {
  it("returns nothing on the first cycle when nothing moved", async () => {
    const { store, rawValue } = createStore();
    const spikes = await detectSpikes([makeSnapshot()], store);
    expect(spikes).toHaveLength(0);
    // But the snapshot is now persisted for a future baseline.
    expect(rawValue(HISTORY_KEY)).not.toBeNull();
  });

  it("fires a price spike immediately from the 1h change", async () => {
    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", priceChangeH1: 12.5 })],
      createStore().store
    );
    expect(spikes).toHaveLength(1);
    expect(spikes[0].kind).toBe("price");
    expect(spikes[0].magnitude).toBe(12.5);
  });

  it("fires a price spike from the 24h change", async () => {
    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", priceChangeH24: -31 })],
      createStore().store
    );
    expect(spikes).toHaveLength(1);
    expect(spikes[0].kind).toBe("price");
    expect(spikes[0].magnitude).toBe(-31);
  });

  it("does not fire below the threshold", async () => {
    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", priceChangeH1: 7.9 })],
      createStore().store
    );
    expect(spikes).toHaveLength(0);
  });

  it("needs a prior sample before a volume spike can fire", async () => {
    const { store } = createStore();
    await detectSpikes([makeSnapshot({ pairAddress: "P", volumeH1: 1000 })], store);

    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", volumeH1: 3000 })],
      store
    );
    expect(spikes).toHaveLength(1);
    expect(spikes[0].kind).toBe("volume");
    expect(spikes[0].magnitude).toBe(3); // 3000 / 1000 baseline
    expect(spikes[0].baselineVolumeH1).toBe(1000);
  });

  it("does not fire a volume spike below the 2x multiplier", async () => {
    const { store } = createStore();
    await detectSpikes([makeSnapshot({ pairAddress: "P", volumeH1: 1000 })], store);
    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", volumeH1: 1900 })],
      store
    );
    expect(spikes).toHaveLength(0);
  });

  it("keeps the strongest signal per pair", async () => {
    const { store } = createStore();
    await detectSpikes([makeSnapshot({ pairAddress: "P", volumeH1: 1000 })], store);

    // Both signals cross in the next cycle: price +15% out-scores volume 3x.
    const spikes = await detectSpikes(
      [
        makeSnapshot({
          pairAddress: "P",
          volumeH1: 3000,
          priceChangeH1: 15,
        }),
      ],
      store
    );
    expect(spikes).toHaveLength(1);
    expect(spikes[0].kind).toBe("price");
    expect(spikes[0].magnitude).toBe(15);

    // And the reverse: a volume spike can out-score a small price move.
    const { store: store2 } = createStore();
    await detectSpikes(
      [makeSnapshot({ pairAddress: "P", volumeH1: 1000 })],
      store2
    );
    const spikes2 = await detectSpikes(
      [
        makeSnapshot({
          pairAddress: "P",
          volumeH1: 10_000,
          priceChangeH1: 9,
        }),
      ],
      store2
    );
    expect(spikes2).toHaveLength(1);
    expect(spikes2[0].kind).toBe("volume");
    expect(spikes2[0].magnitude).toBe(10);
  });

  it("caps rolling history at 12 samples per pair", async () => {
    const { store } = createStore();
    // Feed 15 flat volumes 1..15 — none spikes because each is < 2x baseline.
    for (let i = 1; i <= 15; i++) {
      await detectSpikes([makeSnapshot({ pairAddress: "P", volumeH1: i })], store);
    }

    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", volumeH1: 200 })],
      store
    );
    // Baseline is the mean of the last 12 history entries (4..15) = 9.5.
    expect(spikes).toHaveLength(1);
    expect(spikes[0].baselineVolumeH1).toBeCloseTo(9.5, 5);
    expect(spikes[0].magnitude).toBeCloseTo(200 / 9.5, 5);
  });

  it("ignores and prunes history older than the TTL window", async () => {
    const { store, rawValue } = createStore();
    const stale = makeSnapshot({
      pairAddress: "P",
      volumeH1: 10_000,
      fetchedAt: Date.now() - HISTORY_TTL_MS - 60_000,
    });
    store.setItem(HISTORY_KEY, JSON.stringify({ P: [stale] }));

    const spikes = await detectSpikes(
      [makeSnapshot({ pairAddress: "P", volumeH1: 30_000 })],
      store
    );
    // No recent baseline → no volume spike despite the huge volume.
    expect(spikes).toHaveLength(0);

    // The stale entry was pruned, leaving only the fresh snapshot.
    const persisted = JSON.parse(rawValue(HISTORY_KEY) ?? "{}");
    expect(persisted.P).toHaveLength(1);
    expect(persisted.P[0].volumeH1).toBe(30_000);
  });

  it("resetHistory clears persisted snapshots", async () => {
    const { store, rawValue } = createStore();
    await detectSpikes([makeSnapshot()], store);
    expect(rawValue(HISTORY_KEY)).not.toBeNull();

    await resetHistory(store);
    expect(rawValue(HISTORY_KEY)).toBeNull();
  });
});