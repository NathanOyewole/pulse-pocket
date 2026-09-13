import { Platform } from "react-native";

/**
 * Detects whether the app is running on a real Seeker device, per Solana
 * Mobile's own documented method (Platform Constants check).
 *
 * This is the lightweight, UI-treatment-only method — it's spoofable by a
 * rooted device or modified app, so it should never be used for anything
 * security-critical or reward-granting. For a guaranteed check (e.g. gating
 * a real feature or reward), Solana Mobile's docs point to verifying
 * ownership of the Seeker Genesis Token via Sign-In-With-Solana against a
 * backend — out of scope here since this app has no backend component.
 */
export function isSeekerDevice(): boolean {
  if (Platform.OS !== "android") return false;
  return Platform.constants?.Model === "Seeker";
}
