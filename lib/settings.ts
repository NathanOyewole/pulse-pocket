import AsyncStorage from "@react-native-async-storage/async-storage";

const SWAP_AMOUNT_KEY = "pulsepocket:swapAmountSol";
const NOTIFS_KEY = "pulsepocket:notificationsEnabled";

export const SWAP_AMOUNT_OPTIONS = [0.01, 0.02, 0.05, 0.1] as const;
export const DEFAULT_SWAP_AMOUNT_SOL = 0.02;
export const SWAP_AMOUNT_MIN_SOL = 0.001;
export const SWAP_AMOUNT_MAX_SOL = 1;

export function isValidSwapAmount(n: number): boolean {
  return (
    Number.isFinite(n) && n >= SWAP_AMOUNT_MIN_SOL && n <= SWAP_AMOUNT_MAX_SOL
  );
}

/** Trim floating-point noise: 0.02 → "0.02", 0.2000000001 → "0.2". */
export function formatSolAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return parseFloat(n.toFixed(6)).toString();
}

export interface AppSettings {
  swapAmountSol: number;
  notificationsEnabled: boolean;
}

export async function loadSettings(): Promise<AppSettings> {
  const [swapRaw, notifsRaw] = await Promise.all([
    AsyncStorage.getItem(SWAP_AMOUNT_KEY),
    AsyncStorage.getItem(NOTIFS_KEY),
  ]);

  const parsed = swapRaw ? Number(swapRaw) : NaN;
  const swapAmountSol = isValidSwapAmount(parsed)
    ? parsed
    : DEFAULT_SWAP_AMOUNT_SOL;

  return {
    swapAmountSol,
    notificationsEnabled: notifsRaw !== "0",
  };
}

export async function saveSwapAmount(amount: number): Promise<void> {
  await AsyncStorage.setItem(SWAP_AMOUNT_KEY, String(amount));
}

export async function saveNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFS_KEY, enabled ? "1" : "0");
}
