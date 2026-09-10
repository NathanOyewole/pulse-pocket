import type { TokenPairSnapshot } from "./types";

// DexScreener public API — no auth required.
// Docs: https://docs.dexscreener.com/api/reference

const BASE_URL = "https://api.dexscreener.com";

// A starter watchlist of Solana pairs to track. Swap/add pair addresses
// as needed — this is intentionally small for the hackathon MVP so we're
// not hammering the API or drowning the feed in noise.
export const WATCHED_PAIR_ADDRESSES: string[] = [
  // Example: SOL/USDC on Raydium — replace/extend with real pairs you want to track
  // "Cbf...actualPairAddress",
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
