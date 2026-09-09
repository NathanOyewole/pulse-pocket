import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "./config";

const AUTH_TOKEN_KEY = "pulsepocket:mwaAuthToken";
const PUBKEY_KEY = "pulsepocket:walletPubkey";

// App identity shown to the wallet app during the authorization prompt.
const APP_IDENTITY = {
  name: "Pulse Pocket",
  uri: "https://usepulse-two.vercel.app",
  // icon: relative path to an icon served from `uri` above — add once we
  // have a hosted icon asset; MWA falls back gracefully without it.
};

// Use Helius if a key is set, otherwise fall back to public devnet RPC
// (fine for early testing, will rate-limit under any real load).
export function getConnection(): Connection {
  const endpoint = config.heliusApiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`
    : clusterApiUrl("devnet");
  return new Connection(endpoint, "confirmed");
}

export interface WalletState {
  connected: boolean;
  pubkey: string | null;
  authToken: string | null;
}

/**
 * Opens the on-device wallet app (Phantom, Solflare, etc.) via Mobile
 * Wallet Adapter and requests authorization. Persists the auth token so
 * we can reconnect without re-prompting the user every time.
 */
export async function connectWallet(): Promise<WalletState> {
  const result = await transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      cluster: "mainnet-beta",
      identity: APP_IDENTITY,
    });

    return authResult;
  });

  const pubkeyBytes = Buffer.from(result.accounts[0].address, "base64");
  const pubkey = new PublicKey(pubkeyBytes).toBase58();

  await AsyncStorage.setItem(AUTH_TOKEN_KEY, result.auth_token);
  await AsyncStorage.setItem(PUBKEY_KEY, pubkey);

  return {
    connected: true,
    pubkey,
    authToken: result.auth_token,
  };
}

/**
 * Attempts to restore a previous session without prompting the wallet UI
 * again, using the stored auth token. Call this on app launch.
 */
export async function restoreWalletSession(): Promise<WalletState> {
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const pubkey = await AsyncStorage.getItem(PUBKEY_KEY);

  if (!authToken || !pubkey) {
    return { connected: false, pubkey: null, authToken: null };
  }

  try {
    await transact(async (wallet: Web3MobileWallet) => {
      await wallet.reauthorize({
        auth_token: authToken,
        identity: APP_IDENTITY,
      });
    });
    return { connected: true, pubkey, authToken };
  } catch {
    // Stored token is stale/revoked — clear it and require a fresh connect.
    await disconnectWallet();
    return { connected: false, pubkey: null, authToken: null };
  }
}

export async function disconnectWallet(): Promise<void> {
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (authToken) {
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
    } catch {
      // Best-effort — proceed to clear local state regardless.
    }
  }

  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, PUBKEY_KEY]);
}

/** SOL balance for the connected wallet, for a quick end-to-end sanity check. */
export async function getBalanceSol(pubkey: string): Promise<number> {
  const connection = getConnection();
  const lamports = await connection.getBalance(new PublicKey(pubkey));
  return lamports / 1_000_000_000;
}

// NOTE: swap execution (Jupiter) is intentionally not in this file yet —
// that gets wired in once the feed UI exists, since a swap needs a specific
// narrative card's token pair as input. This module only covers connect/
// disconnect/balance, which is enough to prove the wallet integration works.
