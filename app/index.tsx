import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../constants/theme";
import { runPipelineCycle } from "../lib/pipeline";
import type { Narrative } from "../lib/types";
import { useWallet } from "../hooks/useWallet";
import { useSettings } from "../hooks/useSettings";
import { NarrativeCard } from "../components/NarrativeCard";
import { hasSeenWelcome } from "../lib/onboarding";
import { notifyNarrative } from "../lib/notifications";

const POLL_INTERVAL_MS = 90_000;

export default function HomeScreen() {
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const wallet = useWallet();
  const { notificationsEnabled } = useSettings();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstCycleRef = useRef(true);

  useEffect(() => {
    hasSeenWelcome().then((seen) => {
      if (!seen) {
        router.replace("/welcome");
      } else {
        setCheckingOnboarding(false);
      }
    });
  }, [router]);

  const runCycle = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const results = await runPipelineCycle();

        if (!isFirstCycleRef.current && notificationsEnabled) {
          for (const narrative of results) {
            notifyNarrative(narrative).catch(() => {});
          }
        }
        isFirstCycleRef.current = false;

        setNarratives((prev) => [...results, ...prev].slice(0, 50));
        setLastRun(Date.now());
        if (results.length === 0 && narratives.length === 0) {
          setError("No spikes detected yet. Feed updates automatically.");
        }
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [narratives.length, notificationsEnabled]
  );

  useEffect(() => {
    if (checkingOnboarding) return;
    runCycle();
    pollRef.current = setInterval(() => runCycle(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingOnboarding]);

  if (checkingOnboarding) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.walletBar}>
        <View style={styles.liveDot} />
        <Text style={styles.walletBarTitle}>PULSE POCKET</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push("/settings")}
          style={styles.gearBtn}
          hitSlop={8}
        >
          <Text style={styles.gearText}>⚙</Text>
        </Pressable>
        {wallet.connected && wallet.pubkey ? (
          <Pressable onPress={() => router.push("/settings")} style={styles.walletPill}>
            <Text style={styles.walletPillText} numberOfLines={1}>
              {wallet.skrDomain
                ? wallet.skrDomain
                : `${wallet.pubkey.slice(0, 4)}...${wallet.pubkey.slice(-4)}`}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={wallet.connect}
            style={styles.walletPill}
            disabled={wallet.loading}
          >
            {wallet.loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.walletPillText}>Connect Wallet</Text>
            )}
          </Pressable>
        )}
      </View>

      <FlatList
        data={narratives}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => runCycle(true)}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => (
          <NarrativeCard
            narrative={item}
            walletConnected={wallet.connected}
            walletPubkey={wallet.pubkey}
            authToken={wallet.authToken}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>No narratives yet</Text>
                <Text style={styles.emptyText}>
                  {error ?? "Pull down to check for fresh signals."}
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          narratives.length > 0 && lastRun ? (
            <Text style={styles.footerText}>
              Last updated {new Date(lastRun).toLocaleTimeString()}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  walletBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  walletBarTitle: {
    color: colors.text.primary,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  gearText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  walletPill: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: 160,
  },
  walletPillText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  feedContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  footerText: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
