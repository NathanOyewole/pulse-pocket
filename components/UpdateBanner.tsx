import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";
import { useAppUpdates } from "../hooks/useAppUpdates";

/**
 * Slim OTA update bar above the feed. Auto-download happens in the background
 * (useAppUpdates); this bar only appears once a newer bundle is downloaded,
 * i.e. the tap is "restart to apply". Hides entirely on builds that can't
 * receive updates (Expo Go, stale APK).
 */
export function UpdateBanner() {
  const updates = useAppUpdates();

  if (!updates.supported || !updates.updateReady) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Update ready</Text>
          <Text style={styles.subtitle}>
            New version downloaded — restart to apply
          </Text>
        </View>
        <Pressable
          style={styles.button}
          onPress={() => {
            updates.applyAndRestart().catch(() => {});
          }}
        >
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
      </View>
      {updates.isDownloading ? (
        <View style={styles.downloading}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.downloadingText}>Checking for updates…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentDim,
    borderRadius: 10,
    padding: spacing.sm,
  },
  title: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 12,
  },
  downloading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  downloadingText: {
    color: colors.text.tertiary,
    fontSize: 11,
  },
});