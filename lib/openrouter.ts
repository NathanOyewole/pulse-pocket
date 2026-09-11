import { config } from "./config";
import type { Narrative, Spike } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free-model rotation — try in order, fall back if rate-limited or down.
const MODEL_ROTATION = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
];

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

/** Deterministic blurb so the feed still works when OpenRouter is down. */
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
      // OpenRouter free tier expects these for attribution / routing
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
    throw new Error(`OpenRouter (${model}) failed: ${res.status} ${body.slice(0, 80)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}

/**
 * Generate a narrative blurb for a spike. Tries free OpenRouter models,
 * then falls back to a template so the feed is never empty on LLM failure.
 */
export async function generateNarrative(spike: Spike): Promise<Narrative> {
  const prompt = buildPrompt(spike);
  const headline = buildHeadline(spike);

  for (const model of MODEL_ROTATION) {
    try {
      const blurb = await callModel(model, prompt);
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
    `[openrouter] All models failed for ${spike.baseSymbol} — using template blurb`
  );

  return {
    id: `${spike.pairAddress}-${spike.detectedAt}`,
    spike,
    headline,
    blurb: templateBlurb(spike),
    generatedAt: Date.now(),
  };
}
