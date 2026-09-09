import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { colors, spacing } from "../constants/theme";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Status indicator */}
        <View style={styles.statusRow}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>NARRATIVE RADAR</Text>
        </View>

        <Text style={styles.headline}>
          Attention moves markets.
        </Text>

        <Text style={styles.subhead}>
          Real-time Solana narrative intelligence, in your pocket.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>STATUS</Text>
          <Text style={styles.cardValue}>Scaffold ready</Text>
          <Text style={styles.cardMeta}>
            Day 1 · Expo + Solana Mobile foundation
          </Text>
        </View>

        <Text style={styles.footer}>
          Built for CLOCK IN · Solana Mobile Hackathon
        </Text>
      </View>
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
  card: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.xl,
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
