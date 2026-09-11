import { fetchPairSnapshots } from "./dexscreener";
import { getWatchlistPairs } from "./watchlist";
import { detectSpikes } from "./spikeDetector";
import { generateNarrative } from "./openrouter";
import type { Narrative } from "./types";

/**
 * Runs one full cycle: fetch live data -> detect spikes -> generate
 * narratives for anything new. Call this on an interval (see useNarrativeFeed
 * hook) or manually for testing.
 *
 * Defaults to the auto-discovered watchlist (currently-boosted Solana
 * tokens, refreshed on its own slower cadence — see lib/watchlist.ts).
 * Pass an explicit list to override, e.g. for testing a specific pair.
 */
export async function runPipelineCycle(
  pairAddresses?: string[]
): Promise<Narrative[]> {
  const watchlist = pairAddresses ?? (await getWatchlistPairs());

  if (watchlist.length === 0) {
    console.warn(
      "[pipeline] Watchlist is empty — auto-discovery may have failed on its first run with no cache yet. Will retry next cycle."
    );
    return [];
  }

  const snapshots = await fetchPairSnapshots(watchlist);
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
