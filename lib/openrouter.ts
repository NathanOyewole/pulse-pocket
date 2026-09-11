import { config } from "./config";
import type { Narrative, Spike } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Free-only rotation (Sept 2026 roster).
 *
 * 1. `openrouter/free` — OpenRouter's auto-router picks any healthy free model
 * 2. Explicit free models as fallbacks when the router itself is rate-limited
 *
 * Old IDs like llama-3.1-8b-instruct:free / gemma-2-9b-it:free are no longer
 * on the free tier, which is why earlier rotation always failed.
 */
const MODEL_ROTATION = [
  "openrouter/free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "liquid/lfm-2.5-2.6b:free",
  "nex-agi/nex-n2.5-mini:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
];

// Round-robin start index so successive narratives don't all hammer model[0]
let rotationOffset = 0;

function buildPrompt(spike: Spike): string {
  const { baseSymbol, quoteSymbol, kind, magnitude, currentSnapshot } = spike;

  const factLine =
    kind === "volume"
      ? `1-hour trading volume is ${magnitude.toFixed(1)}x its recent baseline`
      : `price moved ${magnitude > 0 ? "+" : ""}${magnitude.toFixed(1)}% recently`;

  return `You are a crypto market analyst writing a very short, punchy narrative blurb for a mobile app feed.

Token pair: ${baseSymbol}/${quoteSymbol} on Solana
Signal: ${factLine}
Current price: $${currentSnapshot.priceUsd}
24h price change: ${currentSnapshot.priceChangeH24}%

Write exactly 1-2 sentences explaining what's likely happening and why a trader might care. Be concrete and specific, not generic. Do not use hedge phrases like "it's important to note." Do not use markdown.`;
}

function buildHeadline(spike: Spike): string {
  return `${spike.baseSymbol}/${spike.quoteSymbol} ${
    spike.kind === "price"
      ? `${spike.magnitude > 0 ? "up" : "down"} ${Math.abs(spike.magnitude).toFixed(1)}%`
      : `volume ${spike.magnitude.toFixed(1)}x`
  }`;
}

function templateBlurb(spike: Spike): string {
  const { baseSymbol, quoteSymbol, kind, magnitude, currentSnapshot } = spike;
  if (kind === "volume") {
    return `${baseSymbol}/${quoteSymbol} just printed ${magnitude.toFixed(
      1
    )}x its recent 1h volume baseline at $${currentSnapshot.priceUsd.toFixed(
      6
    )}. Liquidity is moving — watch for follow-through.`;
  }
  const dir = magnitude > 0 ? "ripped higher" : "sold off";
  return `${baseSymbol}/${quoteSymbol} ${dir} ${Math.abs(magnitude).toFixed(
    1
  )}% with price at $${currentSnapshot.priceUsd.toFixed(
    6
  )} (24h ${currentSnapshot.priceChangeH24 >= 0 ? "+" : ""}${currentSnapshot.priceChangeH24.toFixed(
    1
  )}%). Momentum is live on Solana.`;
}

async function callModel(model: string, prompt: string): Promise<string> {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter API key missing");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://usepulse-two.vercel.app",
      "X-Title": "Pulse Pocket",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter (${model}) failed: ${res.status} ${body.slice(0, 100)}`
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}

function orderedModels(): string[] {
  const n = MODEL_ROTATION.length;
  const start = rotationOffset % n;
  rotationOffset = (rotationOffset + 1) % n;
  return [...MODEL_ROTATION.slice(start), ...MODEL_ROTATION.slice(0, start)];
}

/**
 * Generate a narrative blurb using only free OpenRouter models.
 * Rotates starting model per call; falls back to template if all fail.
 */
export async function generateNarrative(spike: Spike): Promise<Narrative> {
  const prompt = buildPrompt(spike);
  const headline = buildHeadline(spike);
  const models = orderedModels();

  for (const model of models) {
    try {
      const blurb = await callModel(model, prompt);
      console.log(`[openrouter] ok via ${model} for ${spike.baseSymbol}`);
      return {
        id: `${spike.pairAddress}-${spike.detectedAt}`,
        spike,
        headline,
        blurb,
        generatedAt: Date.now(),
      };
    } catch (err) {
      console.warn(
        `[openrouter] ${model} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.warn(
    `[openrouter] All free models failed for ${spike.baseSymbol} — template blurb`
  );

  return {
    id: `${spike.pairAddress}-${spike.detectedAt}`,
    spike,
    headline,
    blurb: templateBlurb(spike),
    generatedAt: Date.now(),
  };
}
