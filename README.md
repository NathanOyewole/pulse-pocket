# Pulse Pocket

**Real-time Solana narrative intelligence, in your pocket, with wallet-native action.**

Built for **CLOCK IN** — Solana Mobile Hackathon (Sept 8 – Oct 8, 2026)

> Attention precedes liquidity. Narratives move before price does.

## What it does

1. Polls live Solana token price/volume data (DexScreener)
2. Detects momentum spikes (price/volume vs. a short rolling baseline)
3. Rug-screens the mover via Birdeye (mint/freeze authority, top-10 holder %, liquidity, token age)
4. Attaches a live attention-proxy (DexScreener boost velocity + Birdeye buy/sell pressure) so narratives reflect attention arriving before price
5. Uses an LLM (OpenRouter) to generate a short readable narrative blurb
6. Surfaces narratives as a card feed on mobile — persisted across sessions
7. Pushes a spike alert via a native background task — even with the app killed
8. One-tap wallet connect + Jupiter swap directly from a narrative card
9. OTA updates — new versions apply themselves over the air (expo-updates + EAS Update)

## Scope

Pulse Pocket is a single vertical slice of the Pulse vision: **Narrative Radar** — one real signal type, live, on a phone, with a wallet action attached. The broader Pulse platform (smart-wallet intelligence, attention heatmaps, alert engine, the behavioral graph) is roadmap and story — see [`docs/scope.md`](docs/scope.md) — not built or claimed here.

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (development build — required for Mobile Wallet Adapter) |
| Pipeline | Fully on-device: DexScreener polling → spike detection → Birdeye risk + attention proxy → OpenRouter narrative → native background alerts |
| Wallet | `@solana-mobile/mobile-wallet-adapter-protocol-web3js` |
| Swap | Jupiter API |
| RPC | Helius |
| Market data | DexScreener (primary) + Birdeye (risk screen + attention stats) |
| AI | OpenRouter |
| Notifications | Expo Notifications + TaskManager/BackgroundFetch (spike alerts with the app killed). Remote push = post-hackathon upgrade path |
| Updates | expo-updates + EAS Update — OTA JS updates on installed APKs (native changes still need a fresh build) |
| State | React context + AsyncStorage (feed, snapshot/risk/boost caches, notified-alert map, settings) |

## Testing

```bash
pnpm test      # vitest — spike detector, attention-proxy deltas, alert dedupe/cap
pnpm lint      # eslint
npx tsc --noEmit
```

## Submission

CLOCK IN judging pack — paste-ready form copy, demo video script (≤3 min),
deck outline, and judge/test instructions — lives in
[`docs/hackathon.md`](docs/hackathon.md). Scope discipline (what's real vs
roadmap) is in [`docs/scope.md`](docs/scope.md).

## Design

Dark terminal / ticker aesthetic — matching the wider Pulse web vision. Pulse
Pocket is the sliced-down, mobile, wallet-native build of that vision: one
real subsystem ("Narrative Radar") shipped as a working phone app, with the
rest of the platform stated as roadmap.

## Getting Started

```bash
git clone https://github.com/NathanOyewole/pulse-pocket.git
cd pulse-pocket
pnpm install

# API keys live in .env (see .env.example for the four required):
# OpenRouter, Helius, Birdeye, Jupiter

# Important: use a development build (not Expo Go)
pnpm prebuild
pnpm android
```

## Building the submission APK

The judge-facing APK is the **production** EAS profile (internal distribution,
so it installs directly; production environment; embeds `channel: production`
for OTA updates):

```bash
pnpm build:prod        # eas build --profile production --platform android
```

- Development client (`pnpm build:dev`) and preview builds can **not** receive
  OTA updates — only production embeds the updates channel.
- After installing the production APK once, future JS changes ship over the
  air with `eas update --channel production --auto`.
- Native changes (new module / SDK bump) still require a fresh build.

## Project Structure

```
app/                  # Expo Router screens
components/           # UI components (cards, risk/attention badge, token logo)
lib/                  # Pipeline, detectors, API clients, storage
lib/__tests__/        # Unit tests (detector, attention, alerts)
hooks/                # Custom hooks + providers
constants/            # Theme, colors matching Pulse aesthetic
docs/                 # Scope discipline + submission notes
```

---

Built by [@NathanOyewole](https://github.com/NathanOyewole)