import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchBoostedSolanaTokenAddresses,
  resolveTokensToTopPairs,
  WATCHED_PAIR_ADDRESSES,
} from "./dexscreener";

const CACHE_KEY = "pulsepocket:watchlistCache";

// Discovering "what's trending" doesn't need to happen anywhere near as
// often as the narrative-polling cycle (90s) — boosted-token lists don't
// meaningfully change minute to minute. Refreshing every 15 minutes keeps
// the feed's targets current without hammering the boost endpoints
// (60 req/min limit) or the tokens-resolve endpoint unnecessarily.
const REFRESH_INTERVAL_MS = 15 * 60_000;

// Cap how many auto-discovered pairs we track at once — keeps the narrative
// feed focused rather than trying to watch dozens of long-tail tokens, and
// keeps each polling cycle's DexScreener pair-snapshot batch small.
const MAX_AUTO_DISCOVERED = 15;

interface WatchlistCache {
  pairAddresses: string[];
  refreshedAt: number;
}

async function loadCache(): Promise<WatchlistCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function saveCache(cache: WatchlistCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * Runs the actual discovery: pulls currently-boosted Solana tokens,
 * resolves each to its highest-liquidity pair, and returns the pair
 * addresses (capped, most-liquid first).
 */
async function discoverPairs(): Promise<string[]> {
  const tokenAddresses = await fetchBoostedSolanaTokenAddresses();
  const pairs = await resolveTokensToTopPairs(tokenAddresses);

  const sorted = pairs
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
    .slice(0, MAX_AUTO_DISCOVERED);

  return sorted.map((p) => p.pairAddress);
}

/**
 * Returns the current watchlist of pair addresses to track: manual seed
 * pairs (WATCHED_PAIR_ADDRESSES) plus auto-discovered trending pairs.
 *
 * Uses a cached discovery result when it's still fresh (within
 * REFRESH_INTERVAL_MS) rather than hitting the network every call — the
 * pipeline's polling cycle calls this every 90s, far more often than we
 * actually want to re-run discovery.
 *
 * If discovery fails (network hiccup, rate limit) and a stale cache
 * exists, falls back to the stale list rather than returning nothing —
 * a slightly outdated watchlist beats an empty feed.
 */
export async function getWatchlistPairs(): Promise<string[]> {
  const cache = await loadCache();
  const isFresh = cache && Date.now() - cache.refreshedAt < REFRESH_INTERVAL_MS;

  if (isFresh && cache) {
    return dedupe([...WATCHED_PAIR_ADDRESSES, ...cache.pairAddresses]);
  }

  try {
    const discovered = await discoverPairs();
    await saveCache({ pairAddresses: discovered, refreshedAt: Date.now() });
    return dedupe([...WATCHED_PAIR_ADDRESSES, ...discovered]);
  } catch (err) {
    console.warn(
      "[watchlist] Auto-discovery failed, falling back to last known list:",
      err
    );
    // Stale cache is better than nothing; if there's no cache at all yet
    // (very first run, and discovery failed), we're left with just the
    // manual seed list, which may be empty — the pipeline already handles
    // an empty watchlist gracefully.
    return dedupe([...WATCHED_PAIR_ADDRESSES, ...(cache?.pairAddresses ?? [])]);
  }
}

function dedupe(addresses: string[]): string[] {
  return Array.from(new Set(addresses));
}
