// Feed persistence: the narrative feed used to live only in memory, so a
// reload (or a judge fiddling with the app) wiped the demo. Now it survives
// across sessions in AsyncStorage, deduped by narrative id, oldest-first.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Narrative } from "./types";

const FEED_KEY = "pulsepocket:feed";
export const MAX_FEED_ITEMS = 50;
// Narratives older than this are treated as stale on load: their prices and
// on-chain context no longer describe the present, so showing them as "now"
// would be worse than showing nothing.
export const FEED_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Parses persisted narratives defensively — garbage in yields an empty feed. */
export async function loadFeed(): Promise<Narrative[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const seen = new Set<string>();
    const fresh: Narrative[] = [];
    for (const item of parsed) {
      const n = item as Partial<Narrative>;
      if (!n || typeof n !== "object" || !n.id || !n.spike) continue;
      if (now - (n.generatedAt ?? 0) > FEED_MAX_AGE_MS) continue;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      fresh.push(n as Narrative);
    }

    return fresh
      .sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0))
      .slice(0, MAX_FEED_ITEMS);
  } catch {
    return [];
  }
}

export async function saveFeed(feed: Narrative[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      FEED_KEY,
      JSON.stringify(feed.slice(0, MAX_FEED_ITEMS))
    );
  } catch {
    // Best-effort persistence — the live feed still works without it.
  }
}