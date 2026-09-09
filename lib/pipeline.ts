import { fetchPairSnapshots, WATCHED_PAIR_ADDRESSES } from "./dexscreener";
import { detectSpikes } from "./spikeDetector";
import { generateNarrative } from "./openrouter";
import type { Narrative } from "./types";

/**
 * Runs one full cycle: fetch live data -> detect spikes -> generate
 * narratives for anything new. Call this on an interval (see useNarrativeFeed
 * hook) or manually for testing.
 */
export async function runPipelineCycle(
  pairAddresses: string[] = WATCHED_PAIR_ADDRESSES
): Promise<Narrative[]> {
  if (pairAddresses.length === 0) {
    console.warn(
      "[pipeline] WATCHED_PAIR_ADDRESSES is empty — add some Solana pair addresses in lib/dexscreener.ts to see any data."
    );
    return [];
  }

  const snapshots = await fetchPairSnapshots(pairAddresses);
  const spikes = await detectSpikes(snapshots);

  if (spikes.length === 0) return [];

  const narratives = await Promise.allSettled(
    spikes.map((spike) => generateNarrative(spike))
  );

  return narratives
    .filter(
      (r): r is PromiseFulfilledResult<Narrative> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
