// Attention proxy — the "attention precedes liquidity" signal.
//
// Two cheap, real-time, forward-looking measures (not price):
//   1. Boost velocity — DexScreener "token-boosts" are tokens people have
//      PAID to promote. A spike in boost count for a token that isn't moving
//      yet is literally attention arriving before price.
//   2. Buy/sell pressure + participation — Birdeye token_overview (1h trade,
//      buy, sell counts, unique wallets).
//
// Everything here is best-effort: failures return null / empty maps and the
// feed keeps working. The only persisted state is the previous boost snapshot,
// so boost velocity survives app restarts.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Attention } from "./types";
import { config } from "./config";

const DEXSCREENER_URL = "https://api.dexscreener.com";
const BIRDEYE_URL = "https://public-api.birdeye.so";

const BOOST_KEY = "pulsepocket:boostSnapshot";
const BOOST_REFRESH_MS = 60_000; // one fetch per cycle max, shared across spikes
const ATTENTION_CACHE_TTL_MS = 5 * 60 * 1000;

export type BoostCountMap = Record<string, number>; // lowercase mint -> active boosts

export interface BoostSnapshot {
  map: BoostCountMap;
  deltaMap: BoostCountMap; // boosts added since the last snapshot
}

/** Pure: boosts gained since the previous snapshot (floor at 0). */
export function computeBoostDeltas(
  latest: BoostCountMap,
  previous: BoostCountMap | null
): BoostCountMap {
  const deltas: BoostCountMap = {};
  for (const key of Object.keys(latest)) {
    if (!previous) {
      deltas[key] = 0; // first read = baseline, nothing to report yet
      continue;
    }
    deltas[key] = Math.max(0, latest[key] - (previous[key] ?? 0));
  }
  return deltas;
}

/** Pure: buying pressure as a share of 1h trade counts (0-100). */
export function buyerSharePct(
  buy: number | null,
  sell: number | null
): number | null {
  if (buy == null || sell == null) return null;
  const total = buy + sell;
  if (total <= 0) return null;
  return (buy / total) * 100;
}

async function fetchBoostMap(): Promise<BoostCountMap> {
  const [latestRes, topRes] = await Promise.all([
    fetch(`${DEXSCREENER_URL}/token-boosts/latest/v1`),
    fetch(`${DEXSCREENER_URL}/token-boosts/top/v1`),
  ]);

  const counts: BoostCountMap = {};
  for (const res of [latestRes, topRes]) {
    if (!res.ok) continue;
    const entries: unknown = await res.json().catch(() => null);
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const e = entry as { chainId?: string; tokenAddress?: unknown };
      if (e?.chainId === "solana" && typeof e.tokenAddress === "string") {
        const key = e.tokenAddress.toLowerCase();
        // Count occurrences: duplicate entries = multiple paid boosts.
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return counts;
}

interface BoostState {
  map: BoostCountMap;
  fetchedAt: number;
}

async function readBoostState(): Promise<BoostState | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.map) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeBoostState(state: BoostState): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOST_KEY, JSON.stringify(state));
  } catch {
    // best-effort — velocity just resets next launch
  }
}

let memBoost: { state: BoostState; snapshot: BoostSnapshot } | null = null;

export async function getBoostSnapshot(): Promise<BoostSnapshot> {
  if (memBoost && Date.now() - memBoost.state.fetchedAt < BOOST_REFRESH_MS) {
    return memBoost.snapshot;
  }

  const previous = await readBoostState();
  const map = await fetchBoostMap();
  const state = { map, fetchedAt: Date.now() };
  const snapshot: BoostSnapshot = {
    map,
    deltaMap: computeBoostDeltas(map, previous?.map ?? null),
  };

  memBoost = { state, snapshot };
  await writeBoostState(state);
  return snapshot;
}

interface BirdeyeOverview {
  trade1h: number | null;
  buy1h: number | null;
  sell1h: number | null;
  uniqueWallets1h: number | null;
}

function parseOverview(raw: unknown): BirdeyeOverview {
  if (!raw || typeof raw !== "object") {
    return { trade1h: null, buy1h: null, sell1h: null, uniqueWallets1h: null };
  }
  const d = raw as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  // Field naming is mixed-case in Birdeye; defensively accept both spellings
  // for unique wallets across versions.
  const wallets =
    num(d.uniqueWallets) ??
    num(d.uniqueWallet1h) ??
    num(d.uniqueWallets1h);
  return {
    trade1h: num(d.trade1h),
    buy1h: num(d.buy1h),
    sell1h: num(d.sell1h),
    uniqueWallets1h: wallets,
  };
}

async function fetchOverview(mint: string): Promise<BirdeyeOverview> {
  const res = await fetch(
    `${BIRDEYE_URL}/defi/token_overview?address=${encodeURIComponent(mint)}`,
    {
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": config.birdeyeApiKey,
      },
    }
  );
  if (!res.ok) {
    console.warn(`[attention] token_overview ${mint}: ${res.status}`);
    return { trade1h: null, buy1h: null, sell1h: null, uniqueWallets1h: null };
  }
  const body = await res.json().catch(() => null);
  return parseOverview(body?.data);
}

const inflight = new Map<string, Promise<Attention | null>>();
const memCache = new Map<string, { attention: Attention | null; at: number }>();

/**
 * Attention snapshot for one mint. `boost` is the shared per-cycle snapshot
 * fetched once in the pipeline. Birdeye reads are cached 5 minutes and
 * deduped in-flight to stay inside the public-tier rate limit.
 */
export async function getAttention(
  mint: string,
  boost: BoostSnapshot | null
): Promise<Attention | null> {
  if (!mint) return null;

  const key = mint.toLowerCase();
  const running = inflight.get(key);
  if (running) return running;

  const promise = (async () => {
    const cached = memCache.get(key);
    if (cached && Date.now() - cached.at < ATTENTION_CACHE_TTL_MS) {
      return cached.attention;
    }

    let overview: BirdeyeOverview | null = null;
    if (config.birdeyeApiKey) {
      overview = await fetchOverview(mint).catch(() => null);
    }

    const attention: Attention = {
      mint,
      buyerSharePct: buyerSharePct(overview?.buy1h ?? null, overview?.sell1h ?? null),
      tradeCount1h: overview?.trade1h ?? null,
      uniqueWallets1h: overview?.uniqueWallets1h ?? null,
      boostDeltaLastCycle: boost?.deltaMap[key] ?? null,
      boostTotal: boost?.map[key] ?? null,
      sampledAt: Date.now(),
    };

    // Nothing meaningful to show and no boost info: don't cache noise.
    if (
      attention.buyerSharePct == null &&
      attention.tradeCount1h == null &&
      attention.uniqueWallets1h == null &&
      attention.boostDeltaLastCycle == null &&
      attention.boostTotal == null
    ) {
      return null;
    }

    memCache.set(key, { attention, at: Date.now() });
    return attention;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}