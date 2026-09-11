import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "./wallet";

// Try multiple bases — some networks block one hostname.
const JUPITER_BASES = [
  "https://lite-api.jup.ag/swap/v1",
  "https://api.jup.ag/swap/v1",
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
  for (const base of JUPITER_BASES) {
    try {
      const res = await fetch(`${base}${pathAndQuery}`, init);
      // Accept any HTTP response from a reachable host; caller checks ok.
      return res;
    } catch (err) {
      lastErr = err;
      console.warn(`[jupiter] ${base} unreachable:`, err);
    }
  }
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
