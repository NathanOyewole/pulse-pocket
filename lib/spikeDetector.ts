import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spike, TokenPairSnapshot } from "./types";

// How many past snapshots per pair we keep to compute a rolling volume baseline.
const HISTORY_LENGTH = 12;
const STORAGE_KEY = "pulsepocket:snapshotHistory"
// DexScreener already computes 1h / 24h % change server-side — those do NOT
// need local history. Volume spikes still need a short local baseline.
const VOLUME_SPIKE_MULTIPLIER = 2;
const MIN_HISTORY_FOR_VOLUME = 1;
const PRICE_SPIKE_PERCENT_H1 = 8;
const PRICE_SPIKE_PERCENT_H24 = 25;
// Thresholds — tune these once you see real data. Start loose so you
// actually see signals during testing, then tighten to cut noise.
const VOLUME_SPIKE_MULTIPLIER = 1.2; // current h1 volume vs. avg of history
const PRICE_SPIKE_PERCENT = 3; // abs % change in h1 to count as a spike

type HistoryMap = Record<string, TokenPairSnapshot[]>;

async function loadHistory(): Promise<HistoryMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveHistory(history: HistoryMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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
  snapshots: TokenPairSnapshot[]
): Promise<Spike[]> {
  const history = await loadHistory();
  const byPair = new Map<string, Spike>();

  const consider = (spike: Spike) => {
    const existing = byPair.get(spike.pairAddress);
    if (!existing || scoreSpike(spike) > scoreSpike(existing)) {
      byPair.set(spike.pairAddress, spike);
    }
  };

  for (const snapshot of snapshots) {
    const pastSnapshots = history[snapshot.pairAddress] ?? [];
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
    if (pastSnapshots.length >= 1) {
      const baselineVolumeH1 = average(
        pastSnapshots.map((s) => s.volumeH1)
      );

      // Volume spike check
      if (
        baselineVolumeH1 > 0 &&
        snapshot.volumeH1 >= baselineVolumeH1 * VOLUME_SPIKE_MULTIPLIER
      ) {
        spikes.push({
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

      // Price spike check
      if (Math.abs(snapshot.priceChangeH1) >= PRICE_SPIKE_PERCENT) {
        spikes.push({
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
    }

    const updated = [...pastSnapshots, snapshot].slice(-HISTORY_LENGTH);
    history[snapshot.pairAddress] = updated;
  }

  await saveHistory(history);
  return Array.from(byPair.values());
}

/** Clears stored history — useful when testing threshold changes. */
export async function resetHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
