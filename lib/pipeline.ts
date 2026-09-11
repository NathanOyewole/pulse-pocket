import { fetchPairSnapshots } from "./dexscreener";
import { getWatchlistPairs } from "./watchlist";
import { detectSpikes } from "./spikeDetector";
import { generateNarrative } from "./openrouter";
import { getTokenRisk } from "./risks";
import { getAttention, getBoostSnapshot } from "./attention";
import type { Narrative, Spike } from "./types";

const MAX_NARRATIVES_PER_CYCLE = 4;
const DELAY_BETWEEN_LLM_MS = 800; // stay under free-models-per-min

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs one full cycle: fetch live data -> detect spikes -> generate narratives.
 * LLM calls run sequentially with a short delay to respect OpenRouter free-tier
 * rate limits (parallel retries were burning the whole minute budget).
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

  // Strongest moves first
  const ranked = [...spikes].sort(
    (a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude)
  );
  const limited = ranked.slice(0, MAX_NARRATIVES_PER_CYCLE);

  // Rug-screen + attention-proxy the movers. Both run in parallel and never
  // fail the cycle: a rate-limited or missing Birdeye key just means no risk
  // footer on cards. Attention (boost velocity + buy/sell pressure) is what
  // lets a narrative say *why attention is arriving*, not just "price moved."
  const [riskResults, boost] = await Promise.all([
    Promise.allSettled(
      limited.map((s) => getTokenRisk(s.currentSnapshot.baseMint))
    ),
    getBoostSnapshot().catch(() => null),
  ]);
  const attentionResults = await Promise.allSettled(
    limited.map((s) => getAttention(s.currentSnapshot.baseMint, boost))
  );
  const screened: Spike[] = limited.map((s, i) => ({
    ...s,
    risk: riskResults[i].status === "fulfilled" ? riskResults[i].value : null,
    attention:
      attentionResults[i].status === "fulfilled"
        ? attentionResults[i].value
        : null,
  }));

  const fulfilled: Narrative[] = [];
  for (let i = 0; i < screened.length; i++) {
    if (i > 0) await sleep(DELAY_BETWEEN_LLM_MS);
    try {
      fulfilled.push(await generateNarrative(screened[i]));
    } catch (err) {
      console.warn("[pipeline] narrative failed:", err);
    }
  }

  console.log(`[pipeline] Generated ${fulfilled.length} narratives`);
  return fulfilled;
}
