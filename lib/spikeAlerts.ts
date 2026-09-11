// Pure logic for background spike alerts — no Expo/RN imports so it's
// unit-testable in Node. The native glue lives in backgroundSpikes.ts.

import type { Spike } from "./types";

// Never blow up the user's notification tray: after a long app-off period
// several pairs can spike at once. Cap per background run.
export const MAX_ALERTS_PER_RUN = 3;

// Once we've alerted on a pair, don't re-alert the same pair until this much
// time passes without it spiking again.
export const ALERT_REPEAT_TTL_MS = 6 * 60 * 60 * 1000;

export type NotifiedMap = Record<string, number>; // pairAddress -> last alertedAt

export interface PlanResult {
  toNotify: Spike[];
  next: NotifiedMap;
}

/**
 * Decides which fresh spikes deserve an alert, deduping and pruning the
 * notified map. Pure — the caller persists `next`.
 */
export function planNotifications(
  spikes: Spike[],
  notified: NotifiedMap,
  now: number,
  ttlMs: number = ALERT_REPEAT_TTL_MS,
  maxAlerts: number = MAX_ALERTS_PER_RUN
): PlanResult {
  const pruned: NotifiedMap = {};
  for (const key of Object.keys(notified)) {
    if (now - notified[key] < ttlMs) pruned[key] = notified[key];
  }

  const toNotify: Spike[] = [];
  for (const spike of spikes) {
    if (pruned[spike.pairAddress] !== undefined) continue;
    toNotify.push(spike);
    pruned[spike.pairAddress] = now;
    if (toNotify.length >= maxAlerts) break;
  }

  return { toNotify, next: pruned };
}

/** "US$0.1234" style formatting for raw small-cap prices. */
export function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  return n >= 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(6)}`;
}

export function spikeAlertTitle(spike: Spike): string {
  return `PULSE · ${spike.baseSymbol}/${spike.quoteSymbol}`;
}

export function spikeAlertBody(spike: Spike): string {
  const price = formatPriceUsd(spike.currentSnapshot.priceUsd);
  if (spike.kind === "volume") {
    return `1h volume ${spike.magnitude.toFixed(1)}x baseline at ${price} — momentum is building on Solana.`;
  }
  const dir = spike.magnitude > 0 ? "up" : "down";
  return `Price ${dir} ${Math.abs(spike.magnitude).toFixed(1)}% (1h) to ${price} — momentum is live on Solana.`;
}