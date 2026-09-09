import { config } from "./config";
import type { Narrative, Spike } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Reuse the free-model rotation approach from Pulse — try models in order,
// fall back if one is rate-limited or unavailable.
const MODEL_ROTATION = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
];

function buildPrompt(spike: Spike): string {
  const { baseSymbol, quoteSymbol, kind, magnitude, currentSnapshot } = spike;

  const factLine =
    kind === "volume"
      ? `1-hour trading volume is ${magnitude.toFixed(1)}x its recent baseline`
      : `price moved ${magnitude > 0 ? "+" : ""}${magnitude.toFixed(1)}% in the last hour`;

  return `You are a crypto market analyst writing a very short, punchy narrative blurb for a mobile app feed.

Token pair: ${baseSymbol}/${quoteSymbol} on Solana
Signal: ${factLine}
Current price: $${currentSnapshot.priceUsd}
24h price change: ${currentSnapshot.priceChangeH24}%

Write exactly 1-2 sentences explaining what's likely happening and why a trader might care. Be concrete and specific, not generic. Do not use hedge phrases like "it's important to note." Do not use markdown.`;
}

async function callModel(model: string, prompt: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter (${model}) failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`OpenRouter (${model}) returned empty content`);
  return text;
}

/**
 * Generate a narrative blurb for a spike, rotating through free models
 * until one succeeds.
 */
export async function generateNarrative(spike: Spike): Promise<Narrative> {
  const prompt = buildPrompt(spike);
  let lastError: unknown;

  for (const model of MODEL_ROTATION) {
    try {
      const blurb = await callModel(model, prompt);
      return {
        id: `${spike.pairAddress}-${spike.detectedAt}`,
        spike,
        headline: `${spike.baseSymbol}/${spike.quoteSymbol} ${
          spike.kind === "price"
            ? `${spike.magnitude > 0 ? "up" : "down"} ${Math.abs(spike.magnitude).toFixed(1)}%`
            : `volume ${spike.magnitude.toFixed(1)}x`
        }`,
        blurb,
        generatedAt: Date.now(),
      };
    } catch (err) {
      lastError = err;
      continue; // try next model in rotation
    }
  }

  throw new Error(
    `All OpenRouter models failed. Last error: ${lastError}`
  );
}
