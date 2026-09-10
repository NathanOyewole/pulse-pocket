import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Narrative } from "./types";

// Show notifications with sound/banner even while the app is foregrounded —
// otherwise Expo suppresses them by default when the app is already open,
// which would make testing this confusing ("why isn't it firing?").
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission. Call this once, ideally right after
 * the welcome screen — asking cold on first launch with no context is
 * a common cause of users just denying it reflexively.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("narratives", {
    name: "Narrative alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: "#00ff9d",
  });
}

/**
 * Fires a local notification for a fresh narrative. This is triggered by
 * the in-app polling loop, so it works reliably while the app is open or
 * briefly backgrounded — it will NOT wake the app from fully closed/killed,
 * since there's no server pushing to a device token. That would need a
 * background task + backend, which is out of scope for this build.
 */
export async function notifyNarrative(narrative: Narrative): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: narrative.headline,
      body: narrative.blurb,
      data: { narrativeId: narrative.id },
    },
    trigger: null, // fire immediately
  });
}
