import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../constants/theme";
import type { Digest } from "../lib/digest";
import { TokenLogo } from "./TokenLogo";

interface DigestCardProps {
  digest: Digest;
  onDismiss: () => void;
}

function pctColor(n: number) {
  return n >= 0 ? colors.positive : colors.negative;
}

export function DigestCard({ digest, onDismiss }: DigestCardProps) {
  const router = useRouter();

  function openPair(pairAddress: string) {
    const mover = digest.movers.find((m) => m.pairAddress === pairAddress);
    if (!mover) return;
    router.push({
      pathname: "/pair/[address]",
      params: {
        address: mover.pairAddress,
        headline: mover.headline,
        kind: mover.kind,
        magnitude: String(mover.magnitude),
        imageUrl: mover.imageUrl ?? "",
      },
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>DAY DIGEST · WATCHLIST</Text>
          <Text style={styles.title}>Movers since midnight</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
          <Text style={styles.dismissText}>×</Text>
        </Pressable>
      </View>

      {digest.movers.map((mover) => (
        <Pressable
          key={mover.pairAddress}
          style={styles.row}
          onPress={() => openPair(mover.pairAddress)}
        >
          <TokenLogo
            uri={mover.imageUrl}
            symbol={mover.baseSymbol}
            size={26}
          />
          <Text style={styles.symbol} numberOfLines={1}>
            {mover.baseSymbol}/{mover.quoteSymbol}
          </Text>
          <Text
            style={[styles.pct, { color: pctColor(mover.priceChangeH24) }]}
            numberOfLines={1}
          >
            {mover.priceChangeH24 >= 0 ? "+" : ""}
            {mover.priceChangeH24.toFixed(1)}%
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Text style={styles.footer}>
        Your watchlist's strongest moves overnight · tap a token to open it ·
        shows once a day
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  kicker: {
    color: colors.text.tertiary,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  dismiss: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dismissText: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  symbol: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  pct: {
    fontSize: 13,
    fontWeight: "700",
  },
  chevron: {
    color: colors.text.tertiary,
    fontSize: 16,
  },
  footer: {
    color: colors.text.muted,
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
});