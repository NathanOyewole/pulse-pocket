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
}

export interface Narrative {
  id: string;
  spike: Spike;
  headline: string; // short, e.g. "SOL/XYZ up 40% in 2h"
  blurb: string; // 1-2 sentence AI-generated explanation
  generatedAt: number;
}
