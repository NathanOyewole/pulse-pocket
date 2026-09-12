import { describe, expect, it } from "vitest";
import { sanitizeBlurb } from "../openrouter";
import type { Spike, TokenPairSnapshot } from "../types";

function makeSnapshot(
  overrides: Partial<TokenPairSnapshot> = {}
): TokenPairSnapshot {
  return {
    pairAddress: "PAIR_1",
    baseSymbol: "PAIRZ",
    baseMint: "Mint1111111111111111111111111111111111111",
    quoteSymbol: "SOL",
    quoteMint: "So11111111111111111111111111111111111111112",
    priceUsd: 0.001869,
    volumeH1: 1000,
    volumeH24: 5000,
    priceChangeH1: 40,
    priceChangeH24: 302,
    liquidityUsd: 10000,
    imageUrl: null,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function makeSpike(overrides: Partial<Spike> = {}): Spike {
  return {
    pairAddress: "PAIR_1",
    baseSymbol: "PAIRZ",
    quoteSymbol: "SOL",
    kind: "price",
    magnitude: 302,
    currentSnapshot: makeSnapshot(),
    baselineVolumeH1: 200,
    detectedAt: Date.now(),
    ...overrides,
  };
}

describe("sanitizeBlurb", () => {
  it("rejects the exact prompt-leak seen in production", () => {
    // Real text that leaked into a live narrative card — the model restated
    // the task instead of writing the blurb, and the old blocklist-only
    // sanitizer didn't catch this exact phrasing since it only matched a
    // fixed set of known junk patterns.
    const leaked =
      "User wants a crypto feed blurb. Constraints: ONLY final text, 1-2 " +
      "sentences, max ~40 words, no markdown, no bullets, no numbering, " +
      "no headings, no reasoning/analysis, no quoting rules, direct/punchy " +
      "trader language.";
    expect(sanitizeBlurb(leaked, makeSpike())).toBeNull();
  });

  it("rejects meta-commentary phrased differently than any known pattern", () => {
    const variant =
      "The task is to write a short blurb about this token following the " +
      "given constraints without any markdown or headings.";
    expect(sanitizeBlurb(variant, makeSpike())).toBeNull();
  });

  it("accepts a genuine blurb that mentions the token symbol", () => {
    const good =
      "PAIRZ/SOL just ripped 302% with price at $0.001869 — momentum is " +
      "live on Solana.";
    expect(sanitizeBlurb(good, makeSpike())).toBe(good);
  });

  it("accepts a genuine blurb that mentions a price/percent figure even without the symbol", () => {
    const good = "This pair is up 302% in the last hour at $0.001869.";
    expect(sanitizeBlurb(good, makeSpike())).toBe(good);
  });

  it("rejects text with no symbol mention and no price/percent figure", () => {
    const vague = "Something is happening in the market right now, apparently.";
    expect(sanitizeBlurb(vague, makeSpike())).toBeNull();
  });

  it("still strips known junk patterns from otherwise-good text", () => {
    const withJunk =
      'Here\'s a thinking process: PAIRZ/SOL up 302% at $0.001869, strong momentum.';
    const result = sanitizeBlurb(withJunk, makeSpike());
    expect(result).not.toBeNull();
    expect(result?.toLowerCase()).not.toContain("thinking process");
  });

  it("does not truncate content at a decimal point in a price or percent", () => {
    // Real bug seen in production: "MM/STONK on Solana price moved +666.0%
    // recently $0." — the text after the second decimal point ("000688...")
    // was silently discarded because the sentence-splitter treated every
    // "." as a sentence boundary, including ones inside numbers.
    const withDecimals =
      "MM/STONK on Solana price moved +666.0% recently, trading at $0.000688 amid a wave of buyer interest.";
    const result = sanitizeBlurb(withDecimals, makeSpike());
    expect(result).toContain("$0.000688");
    expect(result).not.toMatch(/\$0\.\s+\d/); // no stray space after the decimal point
  });
});
