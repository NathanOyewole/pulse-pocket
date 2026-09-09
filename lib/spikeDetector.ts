import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spike, TokenPairSnapshot } from "./types";

// How many past snapshots per pair we keep to compute a rolling baseline.
const HISTORY_LENGTH = 12; // e.g. 12 polls back
const STORAGE_KEY = "pulsepocket:snapshotHistory";

// Thresholds — tune these once you see real data. Start loose so you
// actually see signals during testing, then tighten to cut noise.
const VOLUME_SPIKE_MULTIPLIER = 3; // current h1 volume vs. avg of history
const PRICE_SPIKE_PERCENT = 15; // abs % change in h1 to count as a spike

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

/**
 * Feed in the latest snapshots, update rolling history, and return any
 * spikes detected against each pair's own baseline.
 */
export async function detectSpikes(
  snapshots: TokenPairSnapshot[]
): Promise<Spike[]> {
  const history = await loadHistory();
  const spikes: Spike[] = [];

  for (const snapshot of snapshots) {
    const pastSnapshots = history[snapshot.pairAddress] ?? [];

    if (pastSnapshots.length >= 3) {
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

    // Update rolling history for this pair
    const updated = [...pastSnapshots, snapshot].slice(-HISTORY_LENGTH);
    history[snapshot.pairAddress] = updated;
  }

  await saveHistory(history);
  return spikes;
}

/** Clears stored history — useful when testing threshold changes. */
export async function resetHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
