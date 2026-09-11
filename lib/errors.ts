/**
 * Map raw Solana / Jupiter / wallet errors to short user-facing copy.
 * Never show stack traces or simulation logs in the UI.
 */
export function friendlyError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err ?? "Something went wrong");

  const msg = raw.toLowerCase();

  if (
    msg.includes("no record of a prior credit") ||
    msg.includes("insufficient funds") ||
    msg.includes("insufficient lamports") ||
    msg.includes("attempt to debit")
  ) {
    return "Not enough SOL in this wallet for the swap and fees. Add SOL and try again.";
  }

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("authorization request failed") ||
    msg.includes("-1/authorization")
  ) {
    return "Wallet request was cancelled or timed out. Try again.";
  }

  if (
    msg.includes("network request failed") ||
    msg.includes("network failed") ||
    msg.includes("failed to fetch")
  ) {
    return "Network error. Check your connection and try again.";
  }

  if (msg.includes("no swap route") || msg.includes("no route")) {
    return "No swap route found for this token right now.";
  }

  if (msg.includes("slippage") || msg.includes("0x1771")) {
    return "Price moved too fast (slippage). Try again in a moment.";
  }

  if (msg.includes("blockhash") || msg.includes("expired")) {
    return "Transaction expired. Please try again.";
  }

  if (msg.includes("simulation failed")) {
    return "Swap couldn’t be simulated. You may need more SOL, or this token isn’t tradable.";
  }

  if (msg.includes("jupiter")) {
    // Keep a short Jupiter-related line without raw API dump
    if (msg.includes("quote")) return "Couldn’t get a swap quote. Try again shortly.";
    if (msg.includes("swap")) return "Couldn’t build the swap. Try again shortly.";
  }

  // Strip multiline / logs noise
  const firstLine = raw.split("\n")[0]?.trim() ?? raw;
  if (firstLine.length > 120) {
    return "Swap failed. Please try again.";
  }
  // Avoid showing SendTransactionError internals
  if (/sendtransactionerror|getlogs|catch the/i.test(firstLine)) {
    return "Swap failed. Please try again.";
  }

  return firstLine || "Something went wrong. Please try again.";
}
