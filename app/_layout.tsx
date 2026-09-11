import "../lib/polyfills";
// Registers the TaskManager handler at JS boot so a cold-start background
// fetch from the OS can find it. No side effects other than the registration.
import "../lib/backgroundSpikes";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../constants/theme";
import { WalletProvider } from "../hooks/useWallet";
import { SettingsProvider } from "../hooks/useSettings";

export default function RootLayout() {
  return (
    <WalletProvider>
      <SettingsProvider>
        <StatusBar style="light" />
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
      </SettingsProvider>
    </WalletProvider>
  );
}
