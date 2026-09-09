import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  restoreWalletSession,
  getBalanceSol,
  type WalletState,
} from "../lib/wallet";
import { resolveSkrDomain } from "../lib/skrDomain";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    pubkey: null,
    authToken: null,
  });
  const [balance, setBalance] = useState<number | null>(null);
  const [skrDomain, setSkrDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to silently restore a previous session on mount.
  useEffect(() => {
    restoreWalletSession().then((result) => {
      setState(result);
      if (result.pubkey) {
        resolveSkrDomain(result.pubkey).then(setSkrDomain);
      }
    }).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectWallet();
      setState(result);
      if (result.pubkey) {
        const [bal, domain] = await Promise.all([
          getBalanceSol(result.pubkey),
          resolveSkrDomain(result.pubkey),
        ]);
        setBalance(bal);
        setSkrDomain(domain);
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
      setSkrDomain(null);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { ...state, balance, skrDomain, loading, error, connect, disconnect };
}
