import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "./wallet";

import { config } from "./config";

// lite-api.jup.ag is being actively phased out by Jupiter (deprecated as
// of Jan 2026, rate limit reduced progressively toward full retirement) —
// it's kept only as a last-resort, unauthenticated fallback. api.jup.ag is
// the actually-supported endpoint going forward; Jupiter's own docs now
// recommend an API key even on the free tier for reliability. Get one free
// at https://portal.jup.ag/ and set EXPO_PUBLIC_JUPITER_API_KEY.
const JUPITER_BASES = [
  "https://api.jup.ag/swap/v1",
  "https://lite-api.jup.ag/swap/v1",
];

export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

export interface SwapQuote {
  raw: any;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

function isNetworkFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network failed")
  );
}

async function fetchWithFallback(
  pathAndQuery: string,
  init?: RequestInit
): Promise<Response> {
  let lastErr: unknown;
  let lastAuthFailure: Response | null = null;

  for (const base of JUPITER_BASES) {
    try {
      const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string> | undefined),
      };
      // Only attach the key for api.jup.ag — lite-api.jup.ag doesn't
      // expect it, and won't be around much longer regardless.
      if (base.includes("api.jup.ag") && config.jupiterApiKey) {
        headers["x-api-key"] = config.jupiterApiKey;
      }

      const res = await fetch(`${base}${pathAndQuery}`, { ...init, headers });

      // A 401/403 here most likely means api.jup.ag now requires a key
      // that isn't set — worth trying the next base (lite-api.jup.ag,
      // still keyless for now) rather than failing outright on it.
      if ((res.status === 401 || res.status === 403) && !lastAuthFailure) {
        lastAuthFailure = res;
        continue;
      }

      return res;
    } catch (err) {
      lastErr = err;
      console.warn(`[jupiter] ${base} unreachable:`, err);
    }
  }

  // Every base either errored on network or came back unauthorized —
  // an auth failure is more informative to the caller than a generic
  // network error, so prefer returning that if we have one.
  if (lastAuthFailure) return lastAuthFailure;

  throw lastErr instanceof Error
    ? lastErr
    : new Error("All Jupiter endpoints unreachable");
}

/**
 * Get a swap quote from Jupiter. Amount is in the input token's smallest unit
 * (lamports for SOL).
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 300 // 3% — memecoins move fast
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  let res: Response;
  try {
    res = await fetchWithFallback(`/quote?${params}`);
  } catch (err) {
    if (isNetworkFailure(err)) {
      throw new Error(
        "Jupiter quote: network failed. Check phone data/Wi‑Fi or try again."
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jupiter quote failed: ${res.status}${body ? ` — ${body.slice(0, 120)}` : ""}`
    );
  }

  const data = await res.json();

  if (!data?.outAmount) {
    throw new Error(
      data?.error ||
        "No swap route found for this token (may have no liquidity on Jupiter)."
    );
  }

  return {
    raw: data,
    inputMint,
    outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: data.priceImpactPct,
  };
}

/**
 * Build + sign + send a swap via Jupiter + Mobile Wallet Adapter.
 */
export async function executeSwap(
  authToken: string,
  userPublicKey: string,
  quote: SwapQuote
): Promise<string> {
  let swapRes: Response;
  try {
    swapRes = await fetchWithFallback(`/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote.raw,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
  } catch (err) {
    if (isNetworkFailure(err)) {
      throw new Error(
        "Jupiter swap: network failed. Check phone data/Wi‑Fi or try again."
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!swapRes.ok) {
    const body = await swapRes.text().catch(() => "");
    throw new Error(
      `Jupiter swap build failed: ${swapRes.status}${body ? ` — ${body.slice(0, 120)}` : ""}`
    );
  }

  const { swapTransaction } = await swapRes.json();
  if (!swapTransaction) {
    throw new Error("Jupiter did not return a swapTransaction");
  }

  const txBuffer = Buffer.from(swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.reauthorize({
      auth_token: authToken,
      identity: {
        name: "Pulse Pocket",
        uri: "https://usepulse-two.vercel.app",
      },
    });

    const signedTxs = await wallet.signTransactions({
      transactions: [transaction],
    });

    const connection = getConnection();
    const rawTx = signedTxs[0].serialize();
    const sig = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    return sig;
  });

  return signature;
}

/**
 * Swap a fixed SOL amount into the narrative token's mint.
 */
export async function swapSolForToken(
  authToken: string,
  userPublicKey: string,
  outputMint: string,
  solAmount: number
): Promise<string> {
  const lamports = Math.round(solAmount * 1_000_000_000);
  const quote = await getSwapQuote(MINTS.SOL, outputMint, lamports);
  return executeSwap(authToken, userPublicKey, quote);
}
