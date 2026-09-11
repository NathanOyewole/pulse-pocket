// Shared types for Pulse Pocket's data layer

export type RiskLevel = "low" | "medium" | "high";

/**
 * On-chain rug-screen summary for a token, assembled from Birdeye
 * `token_security` + `token_overview`. Null fields mean Birdeye didn't
 * return them (or the fetch failed — we never fail the feed on this).
 */
export interface TokenRisk {
  mint: string;
  holders: number | null;
  top10HolderPct: number | null; // 0-100
  creatorPct: number | null; // 0-100
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  mintAuthorityActive: boolean | null; // true = issuer can still mint more
  freezeAuthorityActive: boolean | null; // true = issuer can freeze your tokens
  mutableMetadata: boolean | null; // true = token metadata can be edited
  ageHours: number | null;
  onJupiterStrictList: boolean | null;
  level: RiskLevel;
  fetchedAt: number; // unix ms
}

export interface TokenPairSnapshot {
  pairAddress: string;
  baseSymbol: string;
  baseMint: string;
  quoteSymbol: string;
  quoteMint: string;
  priceUsd: number;
  volumeH1: number;
  volumeH24: number;
  priceChangeH1: number;
  priceChangeH24: number;
  liquidityUsd: number;
  imageUrl: string | null;
  fetchedAt: number; // unix ms
}

/**
 * Attention proxy — the "attention precedes liquidity" signal. Cheap,
 * real-time measures of *forward* attention, not price: DexScreener boost
 * velocity (people pay real money to boost a token they expect to move) plus
 * live Birdeye buy/sell pressure. Null fields are best-effort.
 */
export interface Attention {
  mint: string;
  buyerSharePct: number | null; // buy1h / (buy1h+sell1h) — pure buying pressure
  tradeCount1h: number | null;
  uniqueWallets1h: number | null;
  boostDeltaLastCycle: number | null; // new boosts since the pipeline's last read
  boostTotal: number | null; // current number of active boosts
  sampledAt: number; // unix ms
}

export interface Spike {
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  kind: "volume" | "price";
  magnitude: number; // e.g. 4.2 = 4.2x baseline, or % change for price
  currentSnapshot: TokenPairSnapshot;
  baselineVolumeH1: number;
  detectedAt: number;
  risk?: TokenRisk | null; // populated by the pipeline's Birdeye rug-screen
  attention?: Attention | null; // populated by the pipeline's attention proxy
}

export interface Narrative {
  id: string;
  spike: Spike;
  headline: string; // short, e.g. "SOL/XYZ up 40% in 2h"
  blurb: string; // 1-2 sentence AI-generated explanation
  generatedAt: number;
}
