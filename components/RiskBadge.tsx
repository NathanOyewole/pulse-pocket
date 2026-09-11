import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";
import type { TokenRisk, RiskLevel } from "../lib/types";

function levelColor(level: RiskLevel): string {
  if (level === "high") return colors.negative;
  if (level === "medium") return colors.warning;
  return colors.accent;
}

function levelLabel(level: RiskLevel): string {
  if (level === "high") return "HIGH RISK";
  if (level === "medium") return "CAUTION";
  return "LOW RISK";
}

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatLiquidity(n: number | null): string | null {
  return n != null && Number.isFinite(n) && n > 0 ? `liq ${compact(n)}` : null;
}

function formatHolders(n: number | null): string | null {
  return n != null && n > 0 ? `${compactCount(n)} holders` : null;
}

function formatTop10(pct: number | null): string | null {
  return pct != null ? `${pct.toFixed(0)}% top-10` : null;
}

export function riskFlags(risk: TokenRisk): string[] {
  const flags: string[] = [];
  const push = (s: string | null) => {
    if (s) flags.push(s);
  };

  push(formatHolders(risk.holders));
  push(formatTop10(risk.top10HolderPct));
  push(formatLiquidity(risk.liquidityUsd));
  if (risk.mintAuthorityActive) push("mint authority LIVE");
  if (risk.freezeAuthorityActive) push("freezeable");
  if (risk.mutableMetadata) push("metadata mutable");
  if (risk.ageHours != null && risk.ageHours < 48) {
    push(`${Math.max(1, Math.round(risk.ageHours))}h old`);
  }

  return flags.slice(0, 4);
}

/**
 * Compact on-chain risk line for a narrative. Renders nothing when the risk
 * data is absent — the feed must never look broken because Birdeye failed.
 */
export function RiskBadge({ risk }: { risk: TokenRisk | null | undefined }) {
  if (!risk) return null;

  const color = levelColor(risk.level);
  const flags = riskFlags(risk);

  return (
    <View style={styles.badge}>
      <View style={styles.levelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.levelText, { color }]}>{levelLabel(risk.level)}</Text>
        {risk.onJupiterStrictList ? (
          <Text style={styles.strictList}>· on Jupiter strict list</Text>
        ) : null}
      </View>
      {flags.length > 0 ? (
        <Text style={styles.flags}>{flags.join(" · ")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  strictList: {
    color: colors.text.tertiary,
    fontSize: 11,
  },
  flags: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});