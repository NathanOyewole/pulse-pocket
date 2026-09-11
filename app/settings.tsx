import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  TextInput,
} from "react-native";
import { Stack } from "expo-router";
import { colors, spacing } from "../constants/theme";
import { useWallet } from "../hooks/useWallet";
import { useSettings } from "../hooks/useSettings";
import {
  SWAP_AMOUNT_OPTIONS,
  SWAP_AMOUNT_MIN_SOL,
  SWAP_AMOUNT_MAX_SOL,
  formatSolAmount,
  isValidSwapAmount,
} from "../lib/settings";

export default function SettingsScreen() {
  const wallet = useWallet();
  const settings = useSettings();
  const [customRaw, setCustomRaw] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  function commitCustomAmount() {
    const trimmed = customRaw.trim();
    if (!trimmed) return;
    const value = Number(trimmed);
    if (!isValidSwapAmount(value)) {
      setCustomError(
        `Enter an amount between ${SWAP_AMOUNT_MIN_SOL} and ${SWAP_AMOUNT_MAX_SOL} SOL.`
      );
      return;
    }
    setCustomError(null);
    setCustomRaw("");
    settings.setSwapAmountSol(value);
  }

  function selectPreset(amount: number) {
    setCustomRaw("");
    setCustomError(null);
    settings.setSwapAmountSol(amount);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Settings", headerBackTitle: "Feed" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.section}>SWAP SIZE</Text>
        <Text style={styles.hint}>
          One-tap amount on narrative cards. Keep it small.
        </Text>
        <View style={styles.chips}>
          {SWAP_AMOUNT_OPTIONS.map((amt) => {
            const active = settings.swapAmountSol === amt;
            return (
              <Pressable
                key={amt}
                onPress={() => selectPreset(amt)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {amt} SOL
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={[styles.customInput, customError && styles.customInputError]}
            value={customRaw}
            onChangeText={(text) => {
              setCustomRaw(text);
              if (customError) setCustomError(null);
            }}
            placeholder="Custom amount…"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={commitCustomAmount}
            onBlur={commitCustomAmount}
          />
          {customRaw.trim().length > 0 ? (
            <Pressable style={styles.customApply} onPress={commitCustomAmount}>
              <Text style={styles.customApplyText}>Set</Text>
            </Pressable>
          ) : null}
        </View>
        {customError ? (
          <Text style={styles.customErrorText}>{customError}</Text>
        ) : null}
        <Text style={styles.hint}>
          Range {SWAP_AMOUNT_MIN_SOL}–{SWAP_AMOUNT_MAX_SOL} SOL. Active:{" "}
          {formatSolAmount(settings.swapAmountSol)} SOL.
        </Text>

        <Text style={[styles.section, { marginTop: spacing.xl }]}>ALERTS</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.rowTitle}>Narrative notifications</Text>
            <Text style={styles.hint}>
              Local alerts for new spikes while the app is open.
            </Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={settings.setNotificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accentDim }}
            thumbColor={settings.notificationsEnabled ? colors.accent : colors.text.tertiary}
          />
        </View>

        <Text style={[styles.section, { marginTop: spacing.xl }]}>WALLET</Text>
        {wallet.connected && wallet.pubkey ? (
          <>
            <Text style={styles.rowTitle}>
              {wallet.skrDomain ?? "Connected"}
            </Text>
            <Text style={styles.addr} selectable>
              {wallet.pubkey}
            </Text>
            {wallet.balance != null ? (
              <Text style={styles.hint}>
                Balance {wallet.balance.toFixed(4)} SOL
              </Text>
            ) : null}
            <Pressable
              style={styles.disconnect}
              onPress={wallet.disconnect}
              disabled={wallet.loading}
            >
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.connect} onPress={wallet.connect} disabled={wallet.loading}>
            <Text style={styles.connectText}>Connect wallet</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>Pulse Pocket · wallet is your account</Text>
      </ScrollView>
    </>
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
  section: {
    color: colors.text.tertiary,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  hint: {
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.text.secondary,
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.accent,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  customInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text.primary,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  customInputError: {
    borderColor: colors.negative,
  },
  customApply: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  customApplyText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 13,
  },
  customErrorText: {
    color: colors.negative,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  addr: {
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  disconnect: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.negative,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  disconnectText: {
    color: colors.negative,
    fontWeight: "700",
    fontSize: 14,
  },
  connect: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  connectText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 14,
  },
  footer: {
    color: colors.text.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
