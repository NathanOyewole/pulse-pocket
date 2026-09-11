import { config } from "./config";
import type { Narrative, Spike } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_ROTATION = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
];

let rotationOffset = 0;

/** Once free-models-per-day trips, skip API for the rest of the session. */
let freeDayQuotaExhausted = false;

function buildMessages(spike: Spike): { role: string; content: string }[] {
  const { baseSymbol, quoteSymbol, kind, magnitude, currentSnapshot } = spike;

  const factLine =
    kind === "volume"
      ? `1h volume is ${magnitude.toFixed(1)}x its recent baseline`
      : `price moved ${magnitude > 0 ? "+" : ""}${magnitude.toFixed(1)}% recently`;

  const system = `You write ultra-short crypto feed blurbs for a mobile app.
Rules you MUST follow:
- Output ONLY the final blurb text. Nothing else.
- Exactly 1 or 2 sentences. Max ~40 words.
- No markdown, no bullet lists, no numbering, no headings.
- Do NOT show reasoning, analysis steps, or "thinking process".
- Do NOT quote the instructions or restate the rules.
- Direct, punchy trader language.`;

  const user = `${baseSymbol}/${quoteSymbol} on Solana. Signal: ${factLine}. Price $${currentSnapshot.priceUsd}. 24h change ${currentSnapshot.priceChangeH24}%.

Write the blurb now:`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildHeadline(spike: Spike): string {
  return `${spike.baseSymbol}/${spike.quoteSymbol} ${
    spike.kind === "price"
      ? `${spike.magnitude > 0 ? "up" : "down"} ${Math.abs(spike.magnitude).toFixed(1)}%`
      : `volume ${spike.magnitude.toFixed(1)}x`
  }`;
}

function formatPrice(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function templateBlurb(spike: Spike): string {
  const { baseSymbol, quoteSymbol, kind, magnitude, currentSnapshot } = spike;
  if (kind === "volume") {
    return `${baseSymbol}/${quoteSymbol} just printed ${magnitude.toFixed(
      1
    )}x its recent 1h volume baseline at $${formatPrice(
      currentSnapshot.priceUsd
    )}. Liquidity is moving — watch for follow-through.`;
  }
  const dir = magnitude > 0 ? "ripped higher" : "sold off";
  return `${baseSymbol}/${quoteSymbol} ${dir} ${Math.abs(magnitude).toFixed(
    1
  )}% with price at $${formatPrice(currentSnapshot.priceUsd)} (24h ${
    currentSnapshot.priceChangeH24 >= 0 ? "+" : ""
  }${currentSnapshot.priceChangeH24.toFixed(1)}%). Momentum is live on Solana.`;
}

function sanitizeBlurb(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  const junkPatterns = [
    /here's a thinking process[:\s]*/i,
    /thinking process[:\s]*/i,
    /analyze the request[:\s]*/i,
    /let's craft[:\s]*/i,
    /we need to produce[^.]*\./i,
    /we need 1-2 sentences[^.]*\./i,
    /rules you must follow[\s\S]*/i,
    /do not (show|use|include)[^.]*\./gi,
    /\*\*[^*]+\*\*/g,
    /^#+\s+.+$/gm,
    /^\s*[-*]\s+/gm,
    /^\s*\d+[.)]\s+/gm,
  ];

  for (const p of junkPatterns) {
    text = text.replace(p, " ");
  }

  const quoted = text.match(/["“]([^"”]{20,200})["”]/);
  if (quoted?.[1] && !/thinking|analyze|request/i.test(quoted[1])) {
    text = quoted[1];
  }

  text = text.replace(/\s+/g, " ").trim();

  if (
    /thinking process|analyze the request|token pair:\s*|signal:\s*|format:\s*|length:\s*/i.test(
      text
    )
  ) {
    return null;
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    text = sentences.slice(0, 2).join(" ").trim();
  }

  if (text.length < 24 || text.length > 280) return null;
  if (/^\s*(output|blurb|response)\s*:/i.test(text)) return null;

  return text;
}

function isDailyQuotaError(msg: string): boolean {
  return /free-models-per-day|free models per day|1000 free/i.test(msg);
}

async function callModel(model: string, spike: Spike): Promise<string> {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter API key missing");
  }
  if (freeDayQuotaExhausted) {
    throw new Error("OpenRouter free daily quota exhausted");
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
      messages: buildMessages(spike),
      max_tokens: 100,
      temperature: 0.55,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (isDailyQuotaError(body) || isDailyQuotaError(String(res.status))) {
      freeDayQuotaExhausted = true;
      throw new Error(
        "OpenRouter free daily limit hit — using templates until reset or credits"
      );
    }
    throw new Error(
      `OpenRouter (${model}) failed: ${res.status} ${body.slice(0, 100)}`
    );
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error(`OpenRouter (${model}) returned empty content`);

  const cleaned = sanitizeBlurb(raw);
  if (!cleaned) {
    throw new Error(`OpenRouter (${model}) returned unusable CoT/junk`);
  }
  return cleaned;
}

function orderedModels(): string[] {
  const n = MODEL_ROTATION.length;
  const start = rotationOffset % n;
  rotationOffset = (rotationOffset + 1) % n;
  return [...MODEL_ROTATION.slice(start), ...MODEL_ROTATION.slice(0, start)];
}

export async function generateNarrative(spike: Spike): Promise<Narrative> {
  const headline = buildHeadline(spike);

  // Don't burn more failed requests once the day quota is gone
  if (freeDayQuotaExhausted || !config.openRouterApiKey) {
    return {
      id: `${spike.pairAddress}-${spike.detectedAt}`,
      spike,
      headline,
      blurb: templateBlurb(spike),
      generatedAt: Date.now(),
    };
  }

  const models = orderedModels();

  for (const model of models) {
    try {
      const blurb = await callModel(model, spike);
      console.log(`[openrouter] ok via ${model} for ${spike.baseSymbol}`);
      return {
        id: `${spike.pairAddress}-${spike.detectedAt}`,
        spike,
        headline,
        blurb,
        generatedAt: Date.now(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[openrouter] ${model} failed:`, msg);
      if (freeDayQuotaExhausted || isDailyQuotaError(msg)) {
        freeDayQuotaExhausted = true;
        break;
      }
    }
  }

  return {
    id: `${spike.pairAddress}-${spike.detectedAt}`,
    spike,
    headline,
    blurb: templateBlurb(spike),
    generatedAt: Date.now(),
  };
}
