# Pulse Pocket

**Real-time Solana narrative intelligence, in your pocket, with wallet-native action.**

Pulse Pocket is the mobile, wallet-native slice of the Pulse vision — Narrative
Radar. It watches live Solana token activity, detects momentum spikes,
rug-screens the mover on-chain, reads attention before price, writes a short
plain-language narrative, and lets you act on it in one tap.

> Attention precedes liquidity. Narratives move before price does.

## Try it (judges — install in ~30 seconds)

Grab the current build, no build-from-source needed:

- **APK (direct download):** https://github.com/NathanOyewole/pulse-pocket/releases/download/v1.0.0/pulse-pocket.apk
- Or open the [release page](https://github.com/NathanOyewole/pulse-pocket/releases/tag/v1.0.0) for the same file.

Install on any Android device (Seeker or plain phone): download the APK, tap it, allow installs from unknown sources, and open Pulse Pocket. Pull to refresh to trigger a signal cycle. A **SEEKER** badge shows in the header on real Seeker hardware.

Install notes:
- Works without any API keys (DexScreener needs none; missing keys hide the risk badge and swap, and narratives fall back to a labeled template).
- Production build embeds the OTA channel — JS updates reach installed APKs via `eas update --channel production`.
- Requires a real development build for Mobile Wallet Adapter (`expo run:android`); Expo Go won't do wallet connect.

## What it does

1. Polls live Solana price/volume data every 90s (DexScreener)
2. Detects momentum spikes against a rolling on-device baseline (price ≥8% 1h /
   ≥25% 24h; volume ≥2x baseline)
3. Rug-screens the mover via Birdeye on-chain data (mint/freeze authority,
   mutable metadata, top-10 holder %, creator %, liquidity, age)
4. Reads a live attention-proxy (DexScreener boost velocity + Birdeye
   buy/sell/unique-wallet counts) — attention arriving before price
5. Writes a short narrative blurb with an LLM (OpenRouter); a *labeled*
   template fallback when quota is exhausted — never a fabricated story
6. Surfaces narratives as a persisted card feed
7. Alerts via a native background task — real notifications with the app
   killed; tapping one deep-links straight into that token
8. One-tap wallet connect (Mobile Wallet Adapter) + Jupiter swap from the card
9. OTA updates — new versions apply over the air (expo-updates + EAS Update)

Everything runs on-device: feed, caches, and settings live in AsyncStorage.
No backend, nothing to stand up.

Honest scope: Pulse Pocket ships one real subsystem of the wider Pulse platform
(Narrative Radar). The rest of that platform — smart-wallet intelligence,
attention heatmaps, social ingestion, real-time remote push — is stated
roadmap, not built or claimed.

## Tech stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (development build required for Mobile Wallet Adapter) |
| Pipeline | Fully on-device: DexScreener polling → spike detection → Birdeye risk + attention proxy → OpenRouter narrative → native background alerts |
| Wallet | `@solana-mobile/mobile-wallet-adapter-protocol-web3js` |
| Swap | Jupiter API |
| RPC | Helius |
| Market data | DexScreener (primary) + Birdeye (risk screen + attention stats) |
| AI | OpenRouter |
| Notifications | Expo Notifications + TaskManager/BackgroundFetch (alerts with the app killed) |
| Updates | expo-updates + EAS Update — OTA JS updates on installed APKs (native changes need a fresh build) |
| State | React context + AsyncStorage (feed, snapshot/risk/boost caches, notified-alert map, settings) |

## Testing

```bash
pnpm test            # vitest — spike detector, attention-proxy deltas, alert dedupe/cap
pnpm lint            # eslint
pnpm exec tsc --noEmit
```

## Building

```bash
git clone https://github.com/NathanOyewole/pulse-pocket.git
cd pulse-pocket
pnpm install

# API keys live in .env (see .env.example): OpenRouter, Helius, Birdeye, Jupiter
```

Development build (MWA **requires** this, not Expo Go):

```bash
pnpm prebuild
pnpm android
```

Production / judge-facing APK (internal distribution, installs directly;
embeds `channel: production` so installed builds receive OTA updates):

```bash
pnpm run build:prod        # eas build --profile production --platform android
```

Shipping a JS-only change over the air (no rebuild needed):

```bash
eas update --channel production --auto
```

Notes:
- Development and preview builds cannot receive OTA updates — only production
  embeds the updates channel.
- Native changes (new module, SDK bump) still require a fresh APK build.
- APKs built before `expo-updates` was added can't receive updates; reinstall
  once with a current production build.

## Project structure

```
app/                  # Expo Router screens (feed, pair detail, settings, welcome)
components/           # UI components (narrative cards, alert/deep-link banners, risk badge)
lib/                  # Pipeline, detectors, API clients, storage
lib/__tests__/        # Unit tests (detector, attention, alerts)
hooks/                # Custom hooks + providers (wallet, settings, updates)
constants/            # Theme / colors
assets/               # Icons, splash
```

---

Built by [@NathanOyewole](https://github.com/NathanOyewole)