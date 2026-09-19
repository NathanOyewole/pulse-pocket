// OTA updates via expo-updates + EAS Update.
//
// Reality check for users/devs:
// - The native `expo-updates` module is compiled into the APK. An app built
//   BEFORE this module existed cannot receive OTA updates — it must be
//   reinstalled once. After that, future versions ship over-the-air as JS
//   bundle updates (`eas update --channel production`), which is the "users
//   update their app" path.
// - JS updates can't change native code; any native change (new module, SDK,
//   manifest tweak that changes the fingerprint) still needs a new APK.
// - This silently no-ops on Expo Go / stale dev builds (degraded to
//   "Unavailable"), so the rest of the app never breaks.
//
// Flow: on launch (configured ON_LOAD) expo-updates checks the server; when a
// new bundle exists we auto-download it, then surface "restart to apply" — a
// slim bar on the feed and a section in Settings — instead of force-reloading
// mid-session. The update also applies automatically on the next cold start.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Updates from "expo-updates";
import Constants from "expo-constants";

interface AppUpdatesValue {
  /** true when this build can actually talk to the EAS Update server. */
  supported: boolean;
  /** Native app version from app.json (the APK version). */
  nativeVersion: string;
  /** JS runtime version — changes whenever an OTA update is served. */
  runtimeVersion: string | null;
  channel: string | null;
  isChecking: boolean;
  isDownloading: boolean;
  /** new bundle found by the server (auto-download happens in background). */
  updateAvailable: boolean;
  /** new bundle downloaded and ready to apply. */
  updateReady: boolean;
  runningOta: boolean;
  otaUpdatedAt: Date | null;
  checkError: string | null;
  lastCheckedAt: Date | null;
  checkForUpdates: () => Promise<boolean>;
  applyAndRestart: () => Promise<boolean>;
}

const AppUpdatesContext = createContext<AppUpdatesValue | null>(null);

export function AppUpdatesProvider({ children }: { children: ReactNode }) {
  const {
    currentlyRunning,
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    checkError,
    lastCheckForUpdateTimeSinceRestart,
  } = Updates.useUpdates();

  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(
    lastCheckForUpdateTimeSinceRestart ?? null
  );
  const downloadedRef = useRef(false);

  // Auto-download the moment a newer bundle is confirmed available. On the
  // next cold start expo-updates also launches the downloaded bundle without
  // any work from us.
  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending && !downloadedRef.current) {
      downloadedRef.current = true;
      Updates.fetchUpdateAsync().catch(() => {});
    }
  }, [isUpdateAvailable, isUpdatePending]);

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    try {
      const result = await Updates.checkForUpdateAsync();
      const available = "isAvailable" in result && result.isAvailable;
      setLastCheckedAt(new Date());
      return available;
    } catch (err) {
      setLastCheckedAt(new Date());
      console.warn("[updates] check failed:", err);
      return false;
    }
  }, []);

  const applyAndRestart = useCallback(async (): Promise<boolean> => {
    try {
      await Updates.reloadAsync();
      return true;
    } catch (err) {
      console.warn("[updates] reload failed:", err);
      return false;
    }
  }, []);

  const value = useMemo<AppUpdatesValue>(
    () => ({
      supported: Updates.isEnabled,
      nativeVersion: Constants.expoConfig?.version ?? "—",
      runtimeVersion: Updates.runtimeVersion ?? currentlyRunning.runtimeVersion ?? null,
      channel: Updates.channel ?? null,
      isChecking: isChecking,
      isDownloading: isDownloading,
      updateAvailable: isUpdateAvailable,
      updateReady: isUpdatePending,
      runningOta: !currentlyRunning.isEmbeddedLaunch,
      otaUpdatedAt: currentlyRunning.createdAt ?? null,
      checkError: checkError?.message ?? null,
      lastCheckedAt: lastCheckedAt,
      checkForUpdates,
      applyAndRestart,
    }),
    [
      isChecking,
      isDownloading,
      isUpdateAvailable,
      isUpdatePending,
      currentlyRunning,
      lastCheckedAt,
      checkError,
      checkForUpdates,
      applyAndRestart,
    ]
  );

  return (
    <AppUpdatesContext.Provider value={value}>
      {children}
    </AppUpdatesContext.Provider>
  );
}

export function useAppUpdates(): AppUpdatesValue {
  const ctx = useContext(AppUpdatesContext);
  if (!ctx) {
    throw new Error("useAppUpdates must be used within AppUpdatesProvider");
  }
  return ctx;
}