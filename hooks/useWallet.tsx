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
  connectWallet,
  disconnectWallet,
  restoreWalletSession,
  getBalanceSol,
  type WalletState,
} from "../lib/wallet";
import { resolveSkrDomain } from "../lib/skrDomain";

interface WalletContextValue extends WalletState {
  balance: number | null;
  skrDomain: string | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Mount once at the app root so restore runs a single time and every screen
 * shares the same connected state (no wallet popup on pair detail / remount).
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    pubkey: null,
    authToken: null,
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [skrDomain, setSkrDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await restoreWalletSession();
        if (cancelled) return;
        setState(result);
        if (result.pubkey) {
          const [bal, domain] = await Promise.all([
            getBalanceSol(result.pubkey).catch(() => null),
            resolveSkrDomain(result.pubkey).catch(() => null),
          ]);
          if (!cancelled) {
            setBalance(bal);
            setSkrDomain(domain);
          }
        }
      } catch {
        // stay disconnected
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectWallet();
      setState(result);
      if (result.pubkey) {
        const [bal, domain] = await Promise.all([
          getBalanceSol(result.pubkey).catch(() => null),
          resolveSkrDomain(result.pubkey).catch(() => null),
        ]);
        setBalance(bal);
        setSkrDomain(domain);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await disconnectWallet();
      setState({ connected: false, pubkey: null, authToken: null });
      setBalance(null);
      setSkrDomain(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      balance,
      skrDomain,
      loading: loading || !restored,
      error,
      connect,
      disconnect,
    }),
    [state, balance, skrDomain, loading, restored, error, connect, disconnect]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
