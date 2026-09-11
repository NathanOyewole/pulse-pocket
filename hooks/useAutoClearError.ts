import { useEffect } from "react";

export const ERROR_CLEAR_MS = 2500;

/**
 * After `delayMs`, run `onClear`. Used so swap/network messages don’t stick
 * on the card forever.
 */
export function useAutoClearError(
  active: boolean,
  onClear: () => void,
  delayMs: number = ERROR_CLEAR_MS
) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onClear, delayMs);
    return () => clearTimeout(t);
  }, [active, onClear, delayMs]);
}
