// Birdeye rug-screen for spiked tokens.
//
// Two cost-aware reads per token: token_security (authorities + concentration)
// and token_overview (liquidity, holder count, market cap). Both are cached in
// AsyncStorage for 6h and deduped in-flight, because the public tier is
// rate-limited and security/authority state barely changes anyway.
//
// The pipeline never lets this fail a narrative cycle — any error here just
// yields a null `TokenRisk` and the feed renders without a risk footer.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TokenRisk, RiskLevel } from "./types";
import { config } from "./config";

const BASE_URL = "https://public-api.birdeye.so";
const CACHE_KEY = "pulsepocket:tokenRisks";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface SecurityData {
  ownerAddress: string | null;
  freezeable: boolean | null;
  freezeAuthority: string | null;
  mutableMetadata: boolean | null;
  top10HolderPercent: number | null; // fraction, e.g. 0.30 = 30%
  creatorPercentage: number | null; // fraction
  creationTime: number | null; // unix seconds
  jupStrictList: boolean | null;
}

interface OverviewData {
  holder: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

type CacheMap = Record<string, { risk: TokenRisk; fetchedAt: number }>;

const inflight = new Map<string, Promise<TokenRisk | null>>();

async function readCache(): Promise<CacheMap> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

async function writeCache(entry: CacheMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Persistence is best-effort — the in-memory dedupe already guards us.
  }
}

/** Pulls fields off the Birdeye response with runtime type guards. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseSecurityRaw(raw: unknown): SecurityData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const top10 = d.top10HolderPercent as number | undefined;
  const creator = d.creatorPercentage as number | undefined;
  const created = d.creationTime as number | undefined;
  return {
    ownerAddress:
      typeof d.ownerAddress === "string" ? d.ownerAddress : null,
    freezeable: bool(d.freezeable),
    freezeAuthority:
      typeof d.freezeAuthority === "string" ? d.freezeAuthority : null,
    mutableMetadata: bool(d.mutableMetadata),
    // Birdeye reports concentration as a fraction (0.30); normalize to
    // a percentage once so consumers don't have to remember which it is.
    top10HolderPercent: num(top10) === null ? null : top10! * 100,
    creatorPercentage: num(creator) === null ? null : creator! * 100,
    creationTime: num(created),
    jupStrictList: bool(d.jupStrictList),
  };
}

function parseOverviewRaw(raw: unknown): OverviewData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  return {
    holder: num(d.holder),
    liquidity: num(d.liquidity),
    marketCap: num(d.marketCap),
  };
}

async function fetchSecurity(mint: string): Promise<SecurityData | null> {
  const res = await fetch(
    `${BASE_URL}/defi/token_security?address=${encodeURIComponent(mint)}`,
    {
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": config.birdeyeApiKey,
      },
    }
  );
  if (!res.ok) {
    console.warn(`[risks] token_security ${mint}: ${res.status}`);
    return null;
  }
  const body = await res.json().catch(() => null);
  return parseSecurityRaw(body?.data);
}

async function fetchOverview(mint: string): Promise<OverviewData | null> {
  const res = await fetch(
    `${BASE_URL}/defi/token_overview?address=${encodeURIComponent(mint)}`,
    {
      headers: {
        accept: "application/json",
        "x-chain": "solana",
        "X-API-KEY": config.birdeyeApiKey,
      },
    }
  );
  if (!res.ok) {
    console.warn(`[risks] token_overview ${mint}: ${res.status}`);
    return null;
  }
  const body = await res.json().catch(() => null);
  return parseOverviewRaw(body?.data);
}

function assessSecurity(
  security: SecurityData | null,
  overview: OverviewData | null
): RiskLevel {
  let high = 0;
  let medium = 0;
  let low = 0;

  if (security?.ownerAddress) high += 1; // mint authority live — can inflate supply
  if (security?.freezeable || security?.freezeAuthority) high += 1; // freeze risk
  if (security?.mutableMetadata && security?.ownerAddress) high += 1; // editable + live

  const top10 = security?.top10HolderPercent ?? null;
  if (top10 != null && top10 > 60) high += 1;
  else if (top10 != null && top10 > 40) medium += 1;

  const creator = security?.creatorPercentage ?? null;
  if (creator != null && creator > 10) medium += 1;

  const liquidity = overview?.liquidity ?? null;
  if (liquidity != null && liquidity < 25_000) medium += 1;
  else if (liquidity != null && liquidity > 500_000) low += 1;

  const holders = overview?.holder ?? null;
  if (holders != null && holders > 0 && holders < 50) medium += 1;

  const ageHours =
    security?.creationTime != null
      ? Math.max(0, (Date.now() / 1000 - security.creationTime) / 3600)
      : null;
  if (ageHours != null && ageHours < 48 && ageHours > 1) medium += 1;
  if (ageHours != null && ageHours <= 1) high += 1; // under an hour = fresh mint

  // Presence on Jupiter's strict list is a real credibility signal.
  if (security?.jupStrictList && security.ownerAddress == null) low += 2;

  if (high > 0) return "high";
  if (medium > 0) return "medium";
  if (low > 0) return "low";
  return "medium"; // default when we have nothing concrete to clear it
}

/**
 * Returns a cached-in-memory / persisted `TokenRisk` for a mint, or null when
 * Birdeye is unreachable, rate-limited, or unkeyed. Concurrent calls for the
 * same mint share a single network request.
 */
export async function getTokenRisk(mint: string): Promise<TokenRisk | null> {
  if (!mint) return null;
  if (!config.birdeyeApiKey) {
    console.warn("[risks] Missing EXPO_PUBLIC_BIRDEYE_API_KEY — skipping rug-screen");
    return null;
  }

  const key = mint.toLowerCase();
  const inflightP = inflight.get(key);
  if (inflightP) return inflightP;

  const promise = (async () => {
    const cache = await readCache();
    const cached = cache[key];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.risk;
    }

    const [security, overview] = await Promise.all([
      fetchSecurity(mint).catch(() => null),
      fetchOverview(mint).catch(() => null),
    ]);

    // Neither endpoint answered: don't cache the failure, let it retry later.
    if (!security && !overview) return null;

    const risk: TokenRisk = {
      mint,
      holders: overview?.holder ?? null,
      top10HolderPct: security?.top10HolderPercent ?? null,
      creatorPct: security?.creatorPercentage ?? null,
      liquidityUsd: overview?.liquidity ?? null,
      marketCapUsd: overview?.marketCap ?? null,
      mintAuthorityActive: security?.ownerAddress != null,
      freezeAuthorityActive:
        security?.freezeable === true || security?.freezeAuthority != null,
      mutableMetadata: security?.mutableMetadata ?? null,
      ageHours:
        security?.creationTime != null
          ? Math.max(0, (Date.now() / 1000 - security.creationTime) / 3600)
          : null,
      onJupiterStrictList: security?.jupStrictList ?? null,
      level: assessSecurity(security, overview),
      fetchedAt: Date.now(),
    };

    cache[key] = { risk, fetchedAt: risk.fetchedAt };
    await writeCache(cache);
    return risk;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}