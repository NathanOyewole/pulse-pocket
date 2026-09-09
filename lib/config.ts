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
};

// NOTE: shipping API keys in a client bundle (even React Native) means
// they're extractable from the built app. Fine for a hackathon demo;
// before any public/production release, move OpenRouter/Helius calls
// behind a small backend so keys never ship on-device.
