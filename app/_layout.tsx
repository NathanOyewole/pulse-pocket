import "../lib/polyfills";
// Registers the TaskManager handler at JS boot so a cold-start background
// fetch from the OS can find it. No side effects other than the registration.
import "../lib/backgroundSpikes";

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../constants/theme";
import { WalletProvider } from "../hooks/useWallet";
import { SettingsProvider } from "../hooks/useSettings";
import { AppUpdatesProvider } from "../hooks/useAppUpdates";

/**
 * Closes the alert loop: both spike alert types (the native background task
 * and the in-app narrative notification) carry a `pairAddress` in their
 * notification data. Tapping a notification routes straight into that pair's
 * detail screen — rug-screen, chart link, and the one-tap swap — instead of
 * dropping onto the feed. Handles deep-links from a cold start (app killed)
 * and a warm tap alike, deduped so one tap can't double-push.
 */
function NotificationTapRouter() {
  const handledPairRef = useRef<string | null>(null);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content
        .data as { pairAddress?: string } | null;
      const pairAddress = data?.pairAddress;
      if (!pairAddress || handledPairRef.current === pairAddress) return;
      handledPairRef.current = pairAddress;
      router.push({
        pathname: "/pair/[address]",
        params: { address: pairAddress },
      });
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <WalletProvider>
      <SettingsProvider>
        <AppUpdatesProvider>
          <StatusBar style="light" />
          <NotificationTapRouter />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTintColor: colors.text.primary,
              headerTitleStyle: {
                fontWeight: "600",
              },
              contentStyle: {
                backgroundColor: colors.background,
              },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="welcome"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="pair/[address]"
              options={{
                title: "Pair",
                headerBackTitle: "Feed",
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                title: "Settings",
                headerBackTitle: "Feed",
              }}
            />
          </Stack>
        </AppUpdatesProvider>
      </SettingsProvider>
    </WalletProvider>
  );
}
