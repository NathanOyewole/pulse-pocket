// Daily digest: a lightweight "what moved on your watchlist since midnight"
// summary shown once per day at the top of the feed. The feed itself prunes
// narratives after 6h, so it can't answer "what moved overnight" on its own —
// this lib keeps a rolling log of every spike the pipeline generated so there
// is always a same-day record to summarize.
//
// Pure logic (appendMovers / computeDigest / day helpers) has no React Native
// or Expo imports so it's unit-testable in Node; AsyncStorage wiring lives in
// the same module below the pure section (same pattern as feedStorage).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Narrative } from "./types";

// How long a mover entry stays in the log. Cover a full day plus margin so a
// digest computed in the late evening still sees entries from the morning.
export const MOVERS_LOG_TTL_MS = 26 * 60 * 60 * 1000;
export const MOVERS_LOG_MAX = 60;
export const DIGEST_MAX_MOVERS = 5;

const MOVERS_KEY = "pulsepocket:moversLog";
const DIGEST_SEEN_DAY_KEY = "pulsepocket:digestSeenDay";

export interface MoverEntry {
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  priceChangeH24: number;
  imageUrl: string | null;
  headline: string;
  kind: "volume" | "price";
  magnitude: number;
  ts: number; // unix ms
}

export interface DigestMover {
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  priceChangeH24: number;
  imageUrl: string | null;
  headline: string;
  kind: "volume" | "price";
  magnitude: number;
}

export interface Digest {
  day: string; // YYYY-MM-DD (local), the day the digest summarizes
  movers: DigestMover[]; // strongest first
}

// ---- Pure day helpers -------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Milliseconds at local midnight for `ts`. */
export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- Pure digest logic ------------------------------------------------------

/**
 * Records new narratives into the mover log: replaces a same-pair entry within
 * the TTL (keep the freshest view of that pair), drops entries older than the
 * TTL, sorts newest-first, and caps the log.
 */
export function appendMovers(
  entries: MoverEntry[],
  narratives: Narrative[],
  now: number
): MoverEntry[] {
  const out = entries.filter((e) => now - e.ts < MOVERS_LOG_TTL_MS);
  const byPair = new Map(out.map((e, i) => [e.pairAddress, i]));

  for (const n of narratives) {
    const pairAddress = n.spike?.pairAddress;
    if (!pairAddress) continue;

    const entry: MoverEntry = {
      pairAddress,
      baseSymbol: n.spike.baseSymbol,
      quoteSymbol: n.spike.quoteSymbol,
      priceChangeH24: n.spike.currentSnapshot.priceChangeH24,
      imageUrl: n.spike.currentSnapshot.imageUrl,
      headline: n.headline,
      kind: n.spike.kind,
      magnitude: n.spike.magnitude,
      ts: n.generatedAt || now,
    };

    const existingIdx = byPair.get(pairAddress);
    if (existingIdx !== undefined) {
      out[existingIdx] = entry;
    } else {
      byPair.set(pairAddress, out.length);
      out.push(entry);
    }
  }

  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, MOVERS_LOG_MAX);
}

/**
 * Summarizes everything that moved since local midnight. One mover per pair
 * (freshest wins), strongest move first, capped at DIGEST_MAX_MOVERS. Returns
 * null when nothing has moved yet today — callers then show nothing, not an
 * empty digest.
 */
export function computeDigest(
  entries: MoverEntry[],
  now: number
): Digest | null {
  const start = startOfLocalDay(now);
  const byPair = new Map<string, MoverEntry>();
  for (const e of entries) {
    if (e.ts < start || e.ts > now) continue;
    byPair.set(e.pairAddress, e);
  }

  const movers = [...byPair.values()]
    .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))
    .slice(0, DIGEST_MAX_MOVERS)
    .map((m) => {
      const { ts: _ts, ...rest } = m;
      return rest;
    });

  if (movers.length === 0) return null;
  return { day: dayKey(now), movers };
}

/** A digest is shown only once per day: skip when we've already seen its day. */
export function shouldShowDigest(seenDay: string | null, digest: Digest | null): boolean {
  if (!digest) return false;
  return seenDay !== digest.day;
}

// ---- AsyncStorage wiring ----------------------------------------------------

async function loadMovers(): Promise<MoverEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(MOVERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is MoverEntry => !!e && typeof (e as MoverEntry).pairAddress === "string"
    );
  } catch {
    return [];
  }
}

async function saveMovers(entries: MoverEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MOVERS_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort — the digest just won't be available next time.
  }
}

/**
 * Records a batch of newly generated narratives (call after each cycle that
 * produced results) and persists the log. Fire-and-forget friendly.
 */
export async function recordNarratives(narratives: Narrative[]): Promise<void> {
  if (!narratives.length) return;
  const now = Date.now();
  const next = appendMovers(await loadMovers(), narratives, now);
  await saveMovers(next);
}

/**
 * Builds today's digest, if one is due. Returns null when the digest was
 * already shown today or nothing has moved yet. Caller dismisses with
 * `dismissDigest()` after rendering (or the same action).
 */
export async function getTodayDigest(): Promise<Digest | null> {
  const now = Date.now();
  const [entries, seenDay] = await Promise.all([loadMovers(), loadSeenDay()]);
  const digest = computeDigest(entries, now);
  return shouldShowDigest(seenDay, digest) ? digest : null;
}

async function loadSeenDay(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DIGEST_SEEN_DAY_KEY);
  } catch {
    return null;
  }
}

/** Marks the digest as shown for today so it doesn't re-appear. */
export async function dismissDigest(): Promise<void> {
  try {
    await AsyncStorage.setItem(DIGEST_SEEN_DAY_KEY, dayKey(Date.now()));
  } catch {
    // Best-effort.
  }
}