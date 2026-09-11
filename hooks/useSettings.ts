import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SWAP_AMOUNT_SOL,
  loadSettings,
  saveNotificationsEnabled,
  saveSwapAmount,
  type AppSettings,
} from "../lib/settings";
import { requestNotificationPermission } from "../lib/notifications";

interface SettingsContextValue extends AppSettings {
  setSwapAmountSol: (amount: number) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [swapAmountSol, setSwapAmount] = useState(DEFAULT_SWAP_AMOUNT_SOL);
  const [notificationsEnabled, setNotifs] = useState(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSwapAmount(s.swapAmountSol);
      setNotifs(s.notificationsEnabled);
    });
  }, []);

  const setSwapAmountSol = useCallback(async (amount: number) => {
    setSwapAmount(amount);
    await saveSwapAmount(amount);
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotifs(false);
        await saveNotificationsEnabled(false);
        return;
      }
    }
    setNotifs(enabled);
    await saveNotificationsEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({
      swapAmountSol,
      notificationsEnabled,
      setSwapAmountSol,
      setNotificationsEnabled,
    }),
    [swapAmountSol, notificationsEnabled, setSwapAmountSol, setNotificationsEnabled]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
