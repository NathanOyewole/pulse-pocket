import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";
import type { TokenRisk, RiskLevel, Attention } from "../lib/types";

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

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatLiquidity(n: number | null): string | null {
  return n != null && Number.isFinite(n) && n > 0 ? `liq ${compact(n)}` : null;
}

function formatHolders(n: number | null): string | null {
  return n != null && n > 0 ? `${compactNumber(n)} holders` : null;
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

export function attentionFlags(attention: Attention): string[] {
  const flags: string[] = [];
  const push = (s: string | null) => {
    if (s) flags.push(s);
  };

  push(
    attention.uniqueWallets1h != null
      ? `${compactNumber(attention.uniqueWallets1h)} wallets/1h`
      : null
  );
  push(
    attention.buyerSharePct != null
      ? `${attention.buyerSharePct.toFixed(0)}% buys`
      : null
  );
  push(
    attention.tradeCount1h != null
      ? `${compactNumber(attention.tradeCount1h)} trades/1h`
      : null
  );
  push(
    attention.boostDeltaLastCycle != null && attention.boostDeltaLastCycle > 0
      ? `+${attention.boostDeltaLastCycle} boosts`
      : attention.boostTotal != null && attention.boostTotal > 0
        ? `${attention.boostTotal} boosts`
        : null
  );

  return flags.slice(0, 3);
}

interface RiskBadgeProps {
  risk?: TokenRisk | null;
  attention?: Attention | null;
}

/**
 * Compact on-chain footer for a narrative — risk + live attention. Renders
 * nothing when there's no data: the feed must never look broken because an API
 * was rate-limited or unkeyed.
 */
export function RiskBadge({ risk, attention }: RiskBadgeProps) {
  if (!risk && !attention) return null;

  return (
    <View style={styles.badge}>
      {risk ? (
        <>
          <View style={styles.levelRow}>
            <View
              style={[styles.dot, { backgroundColor: levelColor(risk.level) }]}
            />
            <Text style={[styles.levelText, { color: levelColor(risk.level) }]}>
              {levelLabel(risk.level)}
            </Text>
            {risk.onJupiterStrictList ? (
              <Text style={styles.subtext}>· on Jupiter strict list</Text>
            ) : null}
          </View>
          {riskFlags(risk).length > 0 ? (
            <Text style={styles.flags}>{riskFlags(risk).join(" · ")}</Text>
          ) : null}
        </>
      ) : null}

      {attention ? (
        <>
          <View style={[styles.levelRow, styles.attentionRow]}>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.levelText, { color: colors.accent }]}>
              ACTIVE ATTENTION
            </Text>
          </View>
          {attentionFlags(attention).length > 0 ? (
            <Text style={styles.flags}>
              {attentionFlags(attention).join(" · ")}
            </Text>
          ) : null}
        </>
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
  attentionRow: {
    marginTop: spacing.xs,
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
  subtext: {
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