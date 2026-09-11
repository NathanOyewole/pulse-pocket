import type { TokenPairSnapshot } from "./types";

// DexScreener public API — no auth required.
// Docs: https://docs.dexscreener.com/api/reference

const BASE_URL = "https://api.dexscreener.com";

// Optional manual seed list — pairs you always want tracked regardless of
// what's currently boosted (e.g. a blue-chip pair as a baseline so the feed
// never looks totally empty). Merged with auto-discovered pairs at runtime,
// not required to be filled in — see lib/watchlist.ts for the auto-discovery
// that now drives WATCHED_PAIR_ADDRESSES by default.
export const WATCHED_PAIR_ADDRESSES: string[] = [
  // Example: SOL/USDC on Raydium — add pair addresses here if you want them
  // always included alongside whatever's auto-discovered.
  // "Cbf...actualPairAddress",
  "58oQChx4yWmvKwrbHU1nyskZLuszRW4JqzmgxcBaUb1t", // SOL-USDC Raydium
  "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazym1QKCK5vT",
];

interface DexScreenerPair {
  pairAddress: string;
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string; address: string };
  priceUsd: string;
  volume: { h1: number; h24: number };
  priceChange: { h1: number; h24: number };
  liquidity?: { usd: number };
}

interface DexScreenerPairsResponse {
  pairs: DexScreenerPair[] | null;
}

function toSnapshot(pair: DexScreenerPair): TokenPairSnapshot {
  return {
    pairAddress: pair.pairAddress,
    baseSymbol: pair.baseToken.symbol,
    baseMint: pair.baseToken.address,
    quoteSymbol: pair.quoteToken.symbol,
    quoteMint: pair.quoteToken.address,
    priceUsd: parseFloat(pair.priceUsd),
    volumeH1: pair.volume?.h1 ?? 0,
    volumeH24: pair.volume?.h24 ?? 0,
    priceChangeH1: pair.priceChange?.h1 ?? 0,
    priceChangeH24: pair.priceChange?.h24 ?? 0,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    fetchedAt: Date.now(),
  };
}

interface DexScreenerBoostEntry {
  chainId: string;
  tokenAddress: string;
}

/**
 * Fetches currently-boosted Solana tokens from DexScreener's public boost
 * feeds — a reasonable proxy for "tokens people are actively paying
 * attention to right now" without needing a hand-maintained address list.
 * Combines both the "latest" and "top" boost feeds and dedupes.
 *
 * Rate limit note: these endpoints are capped at 60 req/min (vs 300/min
 * for pair endpoints) — this is called by the watchlist refresh cycle,
 * which runs far less often than the narrative-polling cycle, so this
 * stays well under that limit.
 */
export async function fetchBoostedSolanaTokenAddresses(): Promise<string[]> {
  const [latestRes, topRes] = await Promise.all([
    fetch(`${BASE_URL}/token-boosts/latest/v1`),
    fetch(`${BASE_URL}/token-boosts/top/v1`),
  ]);

  const addresses = new Set<string>();

  for (const res of [latestRes, topRes]) {
    if (!res.ok) continue; // one feed failing shouldn't kill the other
    const entries: DexScreenerBoostEntry[] = await res.json();
    for (const entry of entries) {
      if (entry.chainId === "solana" && entry.tokenAddress) {
        addresses.add(entry.tokenAddress);
      }
    }
  }

  return Array.from(addresses);
}

/**
 * Resolves token (mint) addresses to their trading pairs and picks the
 * single highest-liquidity pair per token — a token can have many pools
 * across different DEXes, and tracking every one would just create
 * duplicate near-identical narratives for the same token.
 */
export async function resolveTokensToTopPairs(
  tokenAddresses: string[]
): Promise<TokenPairSnapshot[]> {
  if (tokenAddresses.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < tokenAddresses.length; i += 30) {
    batches.push(tokenAddresses.slice(i, i + 30));
  }

  const bestPairByToken = new Map<string, TokenPairSnapshot>();

  for (const batch of batches) {
    const url = `${BASE_URL}/latest/dex/tokens/${batch.join(",")}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `DexScreener tokens request failed: ${res.status} ${res.statusText}`
      );
    }

    const data: DexScreenerPairsResponse = await res.json();

    for (const pair of data.pairs ?? []) {
      const snapshot = toSnapshot(pair);
      const key = snapshot.baseMint.toLowerCase();
      const existing = bestPairByToken.get(key);
      if (!existing || snapshot.liquidityUsd > existing.liquidityUsd) {
        bestPairByToken.set(key, snapshot);
      }
    }
  }

  return Array.from(bestPairByToken.values());
}

/**
 * Fetch current snapshots for a set of Solana pair addresses.
 * DexScreener allows batching up to 30 addresses per request.
 */
export async function fetchPairSnapshots(
  pairAddresses: string[]
): Promise<TokenPairSnapshot[]> {
  if (pairAddresses.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < pairAddresses.length; i += 30) {
    batches.push(pairAddresses.slice(i, i + 30));
  }

  const results: TokenPairSnapshot[] = [];

  for (const batch of batches) {
    const url = `${BASE_URL}/latest/dex/pairs/solana/${batch.join(",")}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `DexScreener request failed: ${res.status} ${res.statusText}`
      );
    }

    const data: DexScreenerPairsResponse = await res.json();
    if (data.pairs) {
      results.push(...data.pairs.map(toSnapshot));
    }
  }

  return results;
}

/**
 * Search DexScreener for Solana pairs matching a query (token symbol,
 * name, or address). Useful for building/testing the watchlist before
 * you have exact pair addresses.
 */
export async function searchPairs(query: string): Promise<TokenPairSnapshot[]> {
  const url = `${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`DexScreener search failed: ${res.status} ${res.statusText}`);
  }

  const data: DexScreenerPairsResponse = await res.json();
  const solanaPairs = (data.pairs ?? []).filter(
    (p: any) => p.chainId === "solana"
  );

  return solanaPairs.map(toSnapshot);
}
