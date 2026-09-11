import { fetchPairSnapshots } from "./dexscreener";
import { getWatchlistPairs } from "./watchlist";
import { detectSpikes } from "./spikeDetector";
import { generateNarrative } from "./openrouter";
import type { Narrative } from "./types";

/**
 * Runs one full cycle: fetch live data -> detect spikes -> generate
 * narratives for anything new. Call this on an interval or manually.
 *
 * Defaults to the auto-discovered watchlist (boosted Solana tokens) plus
 * any manual seeds in WATCHED_PAIR_ADDRESSES.
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

  console.log(`[pipeline] Watching ${watchlist.length} pairs`);

  const snapshots = await fetchPairSnapshots(watchlist);
  console.log(`[pipeline] Got ${snapshots.length} snapshots`);

  const spikes = await detectSpikes(snapshots);
  console.log(`[pipeline] Detected ${spikes.length} spikes`);

  if (spikes.length === 0) return [];

  // Cap concurrent LLM calls so we don't burn free-tier quota in one blast
  const limited = spikes.slice(0, 8);
  const narratives = await Promise.allSettled(
    limited.map((spike) => generateNarrative(spike))
  );

  const fulfilled = narratives
    .filter(
      (r): r is PromiseFulfilledResult<Narrative> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  console.log(`[pipeline] Generated ${fulfilled.length} narratives`);
  return fulfilled;
}
