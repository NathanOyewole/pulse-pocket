import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "./wallet";

const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

// Common mint addresses — extend as needed for whatever tokens show up
// in narrative cards.
export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

export interface SwapQuote {
  raw: any; // full Jupiter quote response, passed through to /swap as-is
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

/**
 * Get a swap quote from Jupiter. Amounts are in the input token's smallest
 * unit (e.g. lamports for SOL, 6-decimal units for USDC) — convert before
 * calling this.
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // 0.5% default slippage tolerance
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const res = await fetch(`${JUPITER_QUOTE_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`Jupiter quote failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
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
 * Executes a swap: builds the transaction from a quote via Jupiter's
 * /swap endpoint, then signs and sends it through Mobile Wallet Adapter
 * (opens the wallet app for approval) in the same transact session.
 *
 * Requires the auth token from an already-connected wallet session
 * (see lib/wallet.ts connectWallet/restoreWalletSession).
 */
export async function executeSwap(
  authToken: string,
  userPublicKey: string,
  quote: SwapQuote
): Promise<string> {
  // 1. Build the unsigned swap transaction from Jupiter
  const swapRes = await fetch(JUPITER_SWAP_URL, {
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

  if (!swapRes.ok) {
    throw new Error(`Jupiter swap build failed: ${swapRes.status}`);
  }

  const { swapTransaction } = await swapRes.json();
  const txBuffer = Buffer.from(swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // 2. Sign and send via the wallet app (Phantom/Solflare) through MWA
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.reauthorize({
      auth_token: authToken,
      identity: { name: "Pulse Pocket", uri: "https://usepulse-two.vercel.app" },
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
 * Convenience wrapper for the narrative-card use case: swap a fixed SOL
 * amount into whatever token a spike is about. Amount is in SOL (not
 * lamports) for readability at the call site.
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
