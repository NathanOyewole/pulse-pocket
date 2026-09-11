// Shared types for Pulse Pocket's data layer

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
}

export interface Narrative {
  id: string;
  spike: Spike;
  headline: string; // short, e.g. "SOL/XYZ up 40% in 2h"
  blurb: string; // 1-2 sentence AI-generated explanation
  generatedAt: number;
}
