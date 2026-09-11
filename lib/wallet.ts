import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "./config";

const AUTH_TOKEN_KEY = "pulsepocket:mwaAuthToken";
const PUBKEY_KEY = "pulsepocket:walletPubkey";

export const APP_IDENTITY = {
  name: "Pulse Pocket",
  uri: "https://usepulse-two.vercel.app",
};

export function getConnection(): Connection {
  const endpoint = config.heliusApiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`
    : clusterApiUrl("mainnet-beta");
  return new Connection(endpoint, "confirmed");
}

export interface WalletState {
  connected: boolean;
  pubkey: string | null;
  authToken: string | null;
}

/**
 * Opens the wallet app and requests authorization. Only call this when the
 * user explicitly taps Connect.
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
 * Silent restore from local storage only — does NOT open the wallet app.
 * Reauthorization happens later inside swap (transact session).
 */
export async function restoreWalletSession(): Promise<WalletState> {
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const pubkey = await AsyncStorage.getItem(PUBKEY_KEY);

  if (!authToken || !pubkey) {
    return { connected: false, pubkey: null, authToken: null };
  }

  return { connected: true, pubkey, authToken };
}

export async function disconnectWallet(): Promise<void> {
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (authToken) {
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
    } catch {
      // Best-effort — always clear local state
    }
  }

  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, PUBKEY_KEY]);
}

export async function getBalanceSol(pubkey: string): Promise<number> {
  const connection = getConnection();
  const lamports = await connection.getBalance(new PublicKey(pubkey));
  return lamports / 1_000_000_000;
}
