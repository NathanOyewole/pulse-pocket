import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../constants/theme";
import type { Narrative } from "../lib/types";
import { swapSolForToken } from "../lib/jupiter";
import { friendlyError } from "../lib/errors";
import { useSettings } from "../hooks/useSettings";
import { useAutoClearError } from "../hooks/useAutoClearError";
import { TokenLogo } from "./TokenLogo";

interface NarrativeCardProps {
  narrative: Narrative;
  walletConnected: boolean;
  walletPubkey: string | null;
  authToken: string | null;
  errorResetKey?: number;
}

type SwapStatus = "idle" | "pending" | "success" | "error";

export function NarrativeCard({
  narrative,
  walletConnected,
  walletPubkey,
  authToken,
  errorResetKey = 0,
}: NarrativeCardProps) {
  const router = useRouter();
  const { swapAmountSol } = useSettings();
  const [swapStatus, setSwapStatus] = useState<SwapStatus>("idle");
  const [swapError, setSwapError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const { spike } = narrative;
  const isPositive = spike.kind === "price" ? spike.magnitude > 0 : true;

  const clearSwapError = useCallback(() => {
    setSwapError(null);
    setSwapStatus((s) => (s === "error" ? "idle" : s));
  }, []);

  useAutoClearError(swapStatus === "error", clearSwapError);

  useEffect(() => {
    clearSwapError();
  }, [errorResetKey, clearSwapError]);

  function openDetail() {
    const address = spike.pairAddress;
    if (!address) return;
    router.push({
      pathname: "/pair/[address]",
      params: {
        address,
        headline: narrative.headline,
        blurb: narrative.blurb,
        kind: spike.kind,
        magnitude: String(spike.magnitude),
        imageUrl: spike.currentSnapshot.imageUrl ?? "",
      },
    });
  }

  async function handleSwap() {
    if (!walletPubkey || !authToken) return;

    setSwapStatus("pending");
    setSwapError(null);

    try {
      const signature = await swapSolForToken(
        authToken,
        walletPubkey,
        spike.currentSnapshot.baseMint,
        swapAmountSol
      );
      setTxSignature(signature);
      setSwapStatus("success");
    } catch (err: unknown) {
      setSwapError(friendlyError(err));
      setSwapStatus("error");
    }
  }

  return (
    <Pressable style={styles.card} onPress={openDetail}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <TokenLogo
            uri={spike.currentSnapshot.imageUrl}
            symbol={spike.baseSymbol}
            size={36}
          />
          <View
            style={[
              styles.kindBadge,
              { borderColor: isPositive ? colors.positive : colors.negative },
            ]}
          >
            <Text
              style={[
                styles.kindBadgeText,
                { color: isPositive ? colors.positive : colors.negative },
              ]}
            >
              {spike.kind === "volume" ? "VOLUME SPIKE" : "PRICE MOVE"}
            </Text>
          </View>
        </View>
        <Text style={styles.timestamp}>
          {new Date(narrative.generatedAt).toLocaleTimeString()}
        </Text>
      </View>

      <Text style={styles.headline}>{narrative.headline}</Text>
      <Text style={styles.blurb}>{narrative.blurb}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PRICE</Text>
          <Text style={styles.statValue}>
            ${spike.currentSnapshot.priceUsd.toFixed(6)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>24H</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  spike.currentSnapshot.priceChangeH24 >= 0
                    ? colors.positive
                    : colors.negative,
              },
            ]}
          >
            {spike.currentSnapshot.priceChangeH24 >= 0 ? "+" : ""}
            {spike.currentSnapshot.priceChangeH24.toFixed(1)}%
          </Text>
        </View>
      </View>

      <Text style={styles.tapHint}>Tap for details</Text>

      {swapStatus === "success" && txSignature ? (
        <View style={[styles.swapButton, styles.swapButtonSuccess]}>
          <Text style={styles.swapButtonText}>
            Swapped ✓ {txSignature.slice(0, 8)}...
          </Text>
        </View>
      ) : (
        <Pressable
          style={[
            styles.swapButton,
            (!walletConnected || swapStatus === "pending") &&
              styles.swapButtonDisabled,
          ]}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleSwap();
          }}
          disabled={!walletConnected || swapStatus === "pending"}
        >
          {swapStatus === "pending" ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.swapButtonText}>
              {walletConnected
                ? `Swap ${swapAmountSol} SOL → ${spike.baseSymbol}`
                : "Connect wallet to act on this"}
            </Text>
          )}
        </Pressable>
      )}

      {swapStatus === "error" && swapError ? (
        <Text style={styles.errorText}>{swapError}</Text>
      ) : null}
    </Pressable>
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kindBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timestamp: {
    color: colors.text.tertiary,
    fontSize: 11,
  },
  headline: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  blurb: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  tapHint: {
    color: colors.text.muted,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  swapButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  swapButtonDisabled: {
    backgroundColor: colors.border,
  },
  swapButtonSuccess: {
    backgroundColor: colors.accentDim,
  },
  swapButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: colors.negative,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
