// Env var access. Expo only exposes vars prefixed EXPO_PUBLIC_ to client code.
// Set these in a .env file at the project root (see .env.example) — never
// commit real keys.

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.warn(
      `[config] Missing env var ${name} — related features will fail until it's set.`
    );
    return "";
  }
  return value;
}

function optionalEnv(value: string | undefined): string {
  return value ?? "";
}

export const config = {
  openRouterApiKey: requireEnv(
    "EXPO_PUBLIC_OPENROUTER_API_KEY",
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY
  ),
  heliusApiKey: requireEnv(
    "EXPO_PUBLIC_HELIUS_API_KEY",
    process.env.EXPO_PUBLIC_HELIUS_API_KEY
  ),
  birdeyeApiKey: requireEnv(
    "EXPO_PUBLIC_BIRDEYE_API_KEY",
    process.env.EXPO_PUBLIC_BIRDEYE_API_KEY
  ),
  // Optional, not required: api.jup.ag works without a key at a low fixed
  // rate limit, but Jupiter's own docs recommend one even on the free tier
  // for reliability as lite-api.jup.ag (the old free/keyless host) is being
  // phased out. Get one free at https://portal.jup.ag/
  jupiterApiKey: optionalEnv(process.env.EXPO_PUBLIC_JUPITER_API_KEY),
};

// NOTE: shipping API keys in a client bundle (even React Native) means
// they're extractable from the built app. Fine for a hackathon demo;
// before any public/production release, move OpenRouter/Helius calls
// behind a small backend so keys never ship on-device.
