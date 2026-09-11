import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { colors, spacing } from "../../constants/theme";
import { fetchPairSnapshots } from "../../lib/dexscreener";
import type { TokenPairSnapshot } from "../../lib/types";
import { useWallet } from "../../hooks/useWallet";
import { swapSolForToken } from "../../lib/jupiter";

const SWAP_AMOUNT_SOL = 0.02;

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pctColor(n: number) {
  return n >= 0 ? colors.positive : colors.negative;
}

export default function PairDetailScreen() {
  const params = useLocalSearchParams<{
    address: string;
    headline?: string;
    blurb?: string;
    kind?: string;
    magnitude?: string;
  }>();

  const address = params.address;
  const wallet = useWallet();

  const [snapshot, setSnapshot] = useState<TokenPairSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [swapError, setSwapError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPairSnapshots([address]);
      if (!rows.length) {
        setError("Pair not found on DexScreener.");
        setSnapshot(null);
      } else {
        setSnapshot(rows[0]);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSwap() {
    if (!wallet.pubkey || !wallet.authToken || !snapshot) return;
    setSwapStatus("pending");
    setSwapError(null);
    try {
      const sig = await swapSolForToken(
        wallet.authToken,
        wallet.pubkey,
        snapshot.baseMint,
        SWAP_AMOUNT_SOL
      );
      setTxSignature(sig);
      setSwapStatus("success");
    } catch (err: any) {
      setSwapError(err?.message ?? String(err));
      setSwapStatus("error");
    }
  }

  const title = snapshot
    ? `${snapshot.baseSymbol}/${snapshot.quoteSymbol}`
    : "Pair";

  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: "Feed" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.accent}
          />
        }
      >
        {loading && !snapshot ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : error && !snapshot ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : snapshot ? (
          <>
            {/* Signal from feed (if navigated from a card) */}
            {(params.headline || params.blurb) && (
              <View style={styles.signalCard}>
                {params.kind ? (
                  <Text style={styles.signalKind}>
                    {params.kind === "volume" ? "VOLUME SPIKE" : "PRICE MOVE"}
                    {params.magnitude
                      ? ` · ${Number(params.magnitude).toFixed(1)}${
                          params.kind === "volume" ? "x" : "%"
                        }`
                      : ""}
                  </Text>
                ) : null}
                {params.headline ? (
                  <Text style={styles.signalHeadline}>{params.headline}</Text>
                ) : null}
                {params.blurb ? (
                  <Text style={styles.signalBlurb}>{params.blurb}</Text>
                ) : null}
              </View>
            )}

            {/* Price block */}
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>PRICE USD</Text>
              <Text style={styles.priceValue}>
                ${formatPrice(snapshot.priceUsd)}
              </Text>
              <View style={styles.pctRow}>
                <Text style={[styles.pct, { color: pctColor(snapshot.priceChangeH1) }]}>
                  1h {snapshot.priceChangeH1 >= 0 ? "+" : ""}
                  {snapshot.priceChangeH1.toFixed(1)}%
                </Text>
                <Text style={[styles.pct, { color: pctColor(snapshot.priceChangeH24) }]}>
                  24h {snapshot.priceChangeH24 >= 0 ? "+" : ""}
                  {snapshot.priceChangeH24.toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* Stats grid */}
            <View style={styles.grid}>
              <Stat label="LIQUIDITY" value={formatUsd(snapshot.liquidityUsd)} />
              <Stat label="VOL 1H" value={formatUsd(snapshot.volumeH1)} />
              <Stat label="VOL 24H" value={formatUsd(snapshot.volumeH24)} />
              <Stat
                label="BASE"
                value={snapshot.baseSymbol}
                mono={false}
              />
            </View>

            {/* Addresses */}
            <View style={styles.addrBlock}>
              <Text style={styles.addrLabel}>PAIR</Text>
              <Text style={styles.addrValue} selectable>
                {snapshot.pairAddress}
              </Text>
              <Text style={[styles.addrLabel, { marginTop: spacing.md }]}>
                BASE MINT
              </Text>
              <Text style={styles.addrValue} selectable>
                {snapshot.baseMint}
              </Text>
            </View>

            {/* Chart = DexScreener (no extra deps) */}
            <Pressable
              style={styles.linkButton}
              onPress={() =>
                Linking.openURL(
                  `https://dexscreener.com/solana/${snapshot.pairAddress}`
                )
              }
            >
              <Text style={styles.linkButtonText}>Open chart on DexScreener</Text>
            </Pressable>

            {/* Swap */}
            {swapStatus === "success" && txSignature ? (
              <View style={[styles.swapButton, styles.swapSuccess]}>
                <Text style={styles.swapButtonText}>
                  Swapped ✓ {txSignature.slice(0, 8)}…
                </Text>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.swapButton,
                  (!wallet.connected || swapStatus === "pending") &&
                    styles.swapDisabled,
                ]}
                onPress={handleSwap}
                disabled={!wallet.connected || swapStatus === "pending"}
              >
                {swapStatus === "pending" ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.swapButtonText}>
                    {wallet.connected
                      ? `Swap ${SWAP_AMOUNT_SOL} SOL → ${snapshot.baseSymbol}`
                      : "Connect wallet on feed to swap"}
                  </Text>
                )}
              </Pressable>
            )}
            {swapStatus === "error" && swapError ? (
              <Text style={styles.errorText}>{swapError}</Text>
            ) : null}

            <Text style={styles.footerHint}>
              Pull down to refresh · Data from DexScreener
            </Text>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, !mono && { fontVariant: undefined }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  signalCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  signalKind: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  signalHeadline: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  signalBlurb: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  priceBlock: {
    marginBottom: spacing.lg,
  },
  priceLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  priceValue: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: "700",
  },
  pctRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  pct: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCell: {
    width: "48%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  addrBlock: {
    marginBottom: spacing.lg,
  },
  addrLabel: {
    color: colors.text.tertiary,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addrValue: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  linkButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  linkButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  swapButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  swapDisabled: {
    backgroundColor: colors.border,
  },
  swapSuccess: {
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
    marginTop: spacing.sm,
  },
  footerHint: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
