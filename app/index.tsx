import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { colors, spacing } from "../constants/theme";
import { runPipelineCycle } from "../lib/pipeline";
import type { Narrative } from "../lib/types";
import { useWallet } from "../hooks/useWallet";

// STUB SCREEN — this is a data-layer + wallet test harness, not the real
// feed UI. Once both are confirmed working end-to-end on a real device,
// this gets replaced by the actual swipeable card feed with wallet actions
// attached to each card.

export default function HomeScreen() {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  async function handleRunCycle() {
    setLoading(true);
    setError(null);
    try {
      const results = await runPipelineCycle();
      setNarratives(results);
      if (results.length === 0) {
        setError(
          "Cycle ran, no spikes detected (or WATCHED_PAIR_ADDRESSES is empty — check lib/dexscreener.ts)."
        );
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.statusRow}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>NARRATIVE RADAR — DATA LAYER TEST</Text>
        </View>

        <Text style={styles.headline}>Attention moves markets.</Text>
        <Text style={styles.subhead}>
          Real-time Solana narrative intelligence, in your pocket.
        </Text>

        <View style={[styles.card, { marginBottom: spacing.lg }]}>
          <Text style={styles.cardLabel}>WALLET</Text>
          {wallet.connected && wallet.pubkey ? (
            <>
              <Text style={styles.cardValue}>
                {wallet.skrDomain
                  ? wallet.skrDomain
                  : `${wallet.pubkey.slice(0, 4)}...${wallet.pubkey.slice(-4)}`}
              </Text>
              <Text style={styles.cardMeta}>
                {wallet.balance !== null
                  ? `${wallet.balance.toFixed(4)} SOL`
                  : "Balance loading..."}
              </Text>
              <Pressable
                style={[styles.button, { marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                onPress={wallet.disconnect}
                disabled={wallet.loading}
              >
                <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                  Disconnect
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[styles.button, { marginTop: spacing.sm }]}
              onPress={wallet.connect}
              disabled={wallet.loading}
            >
              {wallet.loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Connect Wallet</Text>
              )}
            </Pressable>
          )}
          {wallet.error && (
            <Text style={[styles.cardMeta, { color: colors.negative, marginTop: spacing.sm }]}>
              {wallet.error}
            </Text>
          )}
        </View>

        <Pressable style={styles.button} onPress={handleRunCycle} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Run pipeline cycle</Text>
          )}
        </Pressable>

        {error && (
          <View style={[styles.card, { borderColor: colors.warning }]}>
            <Text style={styles.cardLabel}>NOTE</Text>
            <Text style={styles.cardMeta}>{error}</Text>
          </View>
        )}

        {narratives.map((n) => (
          <View key={n.id} style={styles.card}>
            <Text style={styles.cardLabel}>{n.headline}</Text>
            <Text style={styles.cardValue}>{n.blurb}</Text>
            <Text style={styles.cardMeta}>
              {n.spike.kind} spike · {n.spike.magnitude.toFixed(2)}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Built for CLOCK IN · Solana Mobile Hackathon
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  statusText: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  headline: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    marginBottom: spacing.md,
  },
  subhead: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  cardValue: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  cardMeta: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  footer: {
    color: colors.text.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
