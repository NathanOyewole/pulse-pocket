import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  restoreWalletSession,
  getBalanceSol,
  type WalletState,
} from "../lib/wallet";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    pubkey: null,
    authToken: null,
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to silently restore a previous session on mount.
  useEffect(() => {
    restoreWalletSession().then(setState).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectWallet();
      setState(result);
      if (result.pubkey) {
        const bal = await getBalanceSol(result.pubkey);
        setBalance(bal);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
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
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { ...state, balance, loading, error, connect, disconnect };
}
