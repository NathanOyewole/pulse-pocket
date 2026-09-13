import { describe, expect, it, vi, beforeEach } from "vitest";

import { resolveSkrDomain } from "../skrDomain";

// Mock getConnection so we don't need a real RPC endpoint for this test.
vi.mock("../wallet", () => ({
  getConnection: () => ({}) as any,
}));

// Mock the TldParser class itself — we're testing that resolveSkrDomain
// calls the correct method and extracts the field correctly, not testing
// AllDomains' own on-chain resolution logic.
const getParsedAllUserDomainsFromTld = vi.fn();
vi.mock("@onsol/tldparser", () => ({
  TldParser: vi.fn().mockImplementation(() => ({
    getParsedAllUserDomainsFromTld,
  })),
}));

describe("resolveSkrDomain", () => {
  beforeEach(() => {
    getParsedAllUserDomainsFromTld.mockReset();
  });

  it("returns the domain string (including .skr suffix) when one exists", async () => {
    // This is the actual shape @onsol/tldparser returns: { nameAccount,
    // domain } where domain already includes the tld suffix. A prior
    // version of this code called a different method that returns raw
    // PublicKey objects instead, and tried to read a .domain field off
    // those — which is always undefined, silently breaking this feature
    // for every wallet. This test locks in the correct method + field.
    getParsedAllUserDomainsFromTld.mockResolvedValue([
      { nameAccount: {}, domain: "nathan.skr" },
    ]);

    const result = await resolveSkrDomain("So11111111111111111111111111111111111111112");
    expect(result).toBe("nathan.skr");
  });

  it("does not double-append .skr to the returned domain", async () => {
    getParsedAllUserDomainsFromTld.mockResolvedValue([
      { nameAccount: {}, domain: "nathan.skr" },
    ]);

    const result = await resolveSkrDomain("So11111111111111111111111111111111111111112");
    expect(result).not.toBe("nathan.skr.skr");
  });

  it("returns null when the wallet has no .skr domain", async () => {
    getParsedAllUserDomainsFromTld.mockResolvedValue([]);
    const result = await resolveSkrDomain("So11111111111111111111111111111111111111112");
    expect(result).toBeNull();
  });

  it("returns null (not a throw) when the lookup fails", async () => {
    getParsedAllUserDomainsFromTld.mockRejectedValue(new Error("RPC error"));
    const result = await resolveSkrDomain("So11111111111111111111111111111111111111112");
    expect(result).toBeNull();
  });
});
