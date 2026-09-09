import { TldParser } from "@onsol/tldparser";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./wallet";

/**
 * Reverse-resolves a wallet's .skr domain, if it has one. Every Seeker
 * device owner gets one .skr domain minted to their wallet — this looks
 * it up via AllDomains so we can show "nathan.skr" instead of a truncated
 * address anywhere a connected wallet is displayed.
 *
 * Returns null if the wallet has no .skr domain (most wallets won't,
 * since it's Seeker-device-specific) or if the lookup fails.
 */
export async function resolveSkrDomain(pubkey: string): Promise<string | null> {
  try {
    const connection = getConnection();
    const parser = new TldParser(connection);

    const domains = await parser.getAllUserDomainsFromTld(
      new PublicKey(pubkey),
      "skr"
    );

    if (!domains || domains.length === 0) return null;

    // A wallet could technically hold more than one if domains were
    // transferred between accounts — just take the first.
    const domainName = (domains[0] as any).domain ?? (domains[0] as any).domain_name;
    return domainName ? `${domainName}.skr` : null;
  } catch (err) {
    console.warn("[skrDomain] Lookup failed:", err);
    return null;
  }
}
