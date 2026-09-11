import type { TokenPairSnapshot } from "./types";

const BASE_URL = "https://api.dexscreener.com";

export const WATCHED_PAIR_ADDRESSES: string[] = [
  "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
  "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
  "58oQChx4yWmvKwrbHU1nyskZLuszRW4JqzmgxcBaUb1t",
  "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazym1QKCK5vT",
  "GYHPVwni3ucwizy9BM4TzTMw3PtSgxm5RRYvL8Ecpump",
  "BifUDWQFpbTrSxYXBnqCpAVYgcyQGzHzJk2MDmeM2Gyv",
];

interface DexScreenerPair {
  pairAddress: string;
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string; address: string };
  priceUsd: string;
  volume: { h1: number; h24: number };
  priceChange: { h1: number; h24: number };
  liquidity?: { usd: number };
  chainId?: string;
  info?: { imageUrl?: string };
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
    imageUrl: pair.info?.imageUrl ?? null,
    fetchedAt: Date.now(),
  };
}

interface DexScreenerBoostEntry {
  chainId: string;
  tokenAddress: string;
}

export async function fetchBoostedSolanaTokenAddresses(): Promise<string[]> {
  const [latestRes, topRes] = await Promise.all([
    fetch(`${BASE_URL}/token-boosts/latest/v1`),
    fetch(`${BASE_URL}/token-boosts/top/v1`),
  ]);

  const addresses = new Set<string>();

  for (const res of [latestRes, topRes]) {
    if (!res.ok) continue;
    const entries: DexScreenerBoostEntry[] = await res.json();
    for (const entry of entries) {
      if (entry.chainId === "solana" && entry.tokenAddress) {
        addresses.add(entry.tokenAddress);
      }
    }
  }

  return Array.from(addresses);
}

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
      if (pair.chainId && pair.chainId !== "solana") continue;
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

export async function searchPairs(query: string): Promise<TokenPairSnapshot[]> {
  const url = `${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`DexScreener search failed: ${res.status} ${res.statusText}`);
  }

  const data: DexScreenerPairsResponse = await res.json();
  const solanaPairs = (data.pairs ?? []).filter(
    (p: DexScreenerPair) => p.chainId === "solana"
  );

  return solanaPairs.map(toSnapshot);
}
