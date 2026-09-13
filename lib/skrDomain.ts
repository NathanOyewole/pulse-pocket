import { TldParser } from "@onsol/tldparser";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./wallet";

/**
 * Reverse-resolves a wallet's .skr domain, if it has one. Every Seeker
 * device owner gets one .skr domain minted to their wallet — this looks
 * it up via AllDomains so we can show "nathan.skr" instead of a truncated
 * address anywhere a connected wallet is displayed.
 *
 * IMPORTANT: uses getParsedAllUserDomainsFromTld, which returns already-
 * resolved { domain: string } objects. An earlier version of this used
 * getAllUserDomainsFromTld, which actually returns raw PublicKey objects
 * (on-chain name-account addresses, not domain strings) — reading a
 * .domain field off those always returned undefined, meaning this
 * silently returned null for every single wallet, including ones that
 * genuinely own a .skr domain. Confirmed via the installed package's own
 * source: the domain field returned here already includes the ".skr"
 * suffix (domain + tldName internally) — do not append it again.
 *
 * Returns null if the wallet has no .skr domain (most wallets won't,
 * since it's Seeker-device-specific) or if the lookup fails.
 */
export async function resolveSkrDomain(pubkey: string): Promise<string | null> {
  try {
    const connection = getConnection();
    const parser = new TldParser(connection);

    const domains = await parser.getParsedAllUserDomainsFromTld(
      new PublicKey(pubkey),
      "skr"
    );

    if (!domains || domains.length === 0) return null;

    // A wallet could technically hold more than one if domains were
    // transferred between accounts — just take the first. Already
    // includes the ".skr" suffix, per the library's own implementation.
    return domains[0].domain ?? null;
  } catch (err) {
    console.warn("[skrDomain] Lookup failed:", err);
    return null;
  }
}
