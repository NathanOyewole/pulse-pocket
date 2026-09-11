import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spike, TokenPairSnapshot } from "./types";

// How many past snapshots per pair we keep to compute a rolling volume baseline.
const HISTORY_LENGTH = 12;
const STORAGE_KEY = "pulsepocket:snapshotHistory";

// Snapshots older than this are ignored when computing the baseline and pruned
// from the persisted history, so a weekend gap doesn't drown out a new move.
export const HISTORY_TTL_MS = 3 * 60 * 60 * 1000;

// DexScreener already computes 1h / 24h % change server-side — those do NOT
// need local history. Volume spikes still need a short local baseline.
const VOLUME_SPIKE_MULTIPLIER = 2;
const MIN_HISTORY_FOR_VOLUME = 1;
const PRICE_SPIKE_PERCENT_H1 = 8;
const PRICE_SPIKE_PERCENT_H24 = 25;

// A minimal key-value store abstraction so the detector can be tested without
// touching React Native's AsyncStorage.
export interface SnapshotStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const asyncStorageStore: SnapshotStore = {
  getItem: AsyncStorage.getItem.bind(AsyncStorage),
  setItem: AsyncStorage.setItem.bind(AsyncStorage),
  removeItem: AsyncStorage.removeItem.bind(AsyncStorage),
};

type HistoryMap = Record<string, TokenPairSnapshot[]>;

async function loadHistory(store: SnapshotStore): Promise<HistoryMap> {
  const raw = await store.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveHistory(
  store: SnapshotStore,
  history: HistoryMap
): Promise<void> {
  await store.setItem(STORAGE_KEY, JSON.stringify(history));
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function scoreSpike(s: Spike): number {
  // Prefer larger absolute moves so we keep one best signal per pair.
  return Math.abs(s.magnitude);
}

/**
 * Feed in the latest snapshots, update rolling history, and return any
 * spikes detected. Price signals use DexScreener's built-in % changes and
 * fire on the first cycle; volume signals need one prior sample.
 */
export async function detectSpikes(
  snapshots: TokenPairSnapshot[],
  store: SnapshotStore = asyncStorageStore
): Promise<Spike[]> {
  const history = await loadHistory(store);
  const byPair = new Map<string, Spike>();
  const now = Date.now();

  const consider = (spike: Spike) => {
    const existing = byPair.get(spike.pairAddress);
    if (!existing || scoreSpike(spike) > scoreSpike(existing)) {
      byPair.set(spike.pairAddress, spike);
    }
  };

  for (const snapshot of snapshots) {
    // Only count recent snapshots in the baseline; stale history (weekend gap)
    // should not drown a real new-volume move.
    const pastSnapshots = (history[snapshot.pairAddress] ?? []).filter(
      (s) => now - s.fetchedAt <= HISTORY_TTL_MS
    );
    const baselineVolumeH1 = average(pastSnapshots.map((s) => s.volumeH1));

    // Price (1h) — available immediately from DexScreener
    if (Math.abs(snapshot.priceChangeH1) >= PRICE_SPIKE_PERCENT_H1) {
      consider({
        pairAddress: snapshot.pairAddress,
        baseSymbol: snapshot.baseSymbol,
        quoteSymbol: snapshot.quoteSymbol,
        kind: "price",
        magnitude: snapshot.priceChangeH1,
        currentSnapshot: snapshot,
        baselineVolumeH1,
        detectedAt: Date.now(),
      });
    }

    // Strong 24h move as a secondary momentum signal (also immediate)
    if (Math.abs(snapshot.priceChangeH24) >= PRICE_SPIKE_PERCENT_H24) {
      consider({
        pairAddress: snapshot.pairAddress,
        baseSymbol: snapshot.baseSymbol,
        quoteSymbol: snapshot.quoteSymbol,
        kind: "price",
        magnitude: snapshot.priceChangeH24,
        currentSnapshot: snapshot,
        baselineVolumeH1,
        detectedAt: Date.now(),
      });
    }

    // Volume vs short local baseline
    if (
      pastSnapshots.length >= MIN_HISTORY_FOR_VOLUME &&
      baselineVolumeH1 > 0 &&
      snapshot.volumeH1 >= baselineVolumeH1 * VOLUME_SPIKE_MULTIPLIER
    ) {
      consider({
        pairAddress: snapshot.pairAddress,
        baseSymbol: snapshot.baseSymbol,
        quoteSymbol: snapshot.quoteSymbol,
        kind: "volume",
        magnitude: snapshot.volumeH1 / baselineVolumeH1,
        currentSnapshot: snapshot,
        baselineVolumeH1,
        detectedAt: Date.now(),
      });
    }

    const updated = [...pastSnapshots, snapshot].slice(-HISTORY_LENGTH);
    history[snapshot.pairAddress] = updated;
  }

  await saveHistory(store, history);
  return Array.from(byPair.values());
}

/** Clears stored history — useful when testing threshold changes. */
export async function resetHistory(
  store: SnapshotStore = asyncStorageStore
): Promise<void> {
  await store.removeItem(STORAGE_KEY);
}