import { View, Text, StyleSheet, Image, Pressable, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../constants/theme";
import { markWelcomeSeen } from "../lib/onboarding";
import { requestNotificationPermission } from "../lib/notifications";
import { ensureBackgroundSpikeTask } from "../lib/backgroundSpikes";

export default function WelcomeScreen() {
  const router = useRouter();

  async function handleGetStarted() {
    await markWelcomeSeen();
    // Fire-and-forget — don't block navigation on the permission dialog,
    // and don't treat a decline as an error. The feed works fine without it.
    requestNotificationPermission()
      .then((granted) => {
        if (granted) {
          // Register the native background task so spikes still alert with
          // the app killed. No-op in Expo Go / on OS restrictions.
          ensureBackgroundSpikeTask().catch(() => {});
        }
      })
      .catch(() => {});
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require("../assets/splash-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.pitchBlock}>
          <PitchLine
            label="LISTEN"
            text="Pulse Pocket watches live Solana token activity for real momentum — price and volume spikes as they happen."
          />
          <PitchLine
            label="UNDERSTAND"
            text="Every spike gets a short, plain-language narrative explaining what's likely moving it."
          />
          <PitchLine
            label="ACT"
            text="Connect your wallet and act on a narrative in one tap — no leaving the feed."
          />
          <PitchLine
            label="STAY ALERTED"
            text="A native background task pushes a spike alert to your phone even when the app is closed."
          />
        </View>

        <Pressable style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Enter the Feed</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Not financial advice. Markets are volatile — trade what you can afford to lose.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function PitchLine({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.pitchLine}>
      <Text style={styles.pitchLabel}>{label}</Text>
      <Text style={styles.pitchText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: "100%",
    height: 140,
    marginBottom: spacing.xxl,
  },
  pitchBlock: {
    marginBottom: spacing.xxl,
    gap: spacing.lg,
  },
  pitchLine: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
  },
  pitchLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pitchText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 15,
  },
  disclaimer: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
