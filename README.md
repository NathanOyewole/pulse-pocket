# Pulse Pocket

**Real-time Solana narrative intelligence, in your pocket, with wallet-native action.**

Built for **CLOCK IN** — Solana Mobile Hackathon (Sept 8 – Oct 8, 2026)

> Attention precedes liquidity. Narratives move before price does.

## What it does

1. Polls live Solana token price/volume data (DexScreener)
2. Detects momentum spikes (price/volume vs. a short rolling baseline)
3. Rug-screens the mover via Birdeye (mint/freeze authority, top-10 holder %, liquidity, token age)
4. Uses an LLM (OpenRouter) to generate a short readable narrative blurb
5. Surfaces narratives as a card feed on mobile — persisted across sessions
6. Pushes a local notification on high-momentum events
7. One-tap wallet connect + Jupiter swap directly from a narrative card

## Scope

Pulse Pocket is a single vertical slice of the Pulse vision: **Narrative Radar** — one real signal type, live, on a phone, with a wallet action attached. The broader Pulse platform (smart-wallet intelligence, attention heatmaps, alert engine, the behavioral graph) is roadmap and story — see [`docs/scope.md`](docs/scope.md) — not built or claimed here.

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (development build — required for Mobile Wallet Adapter) |
| Pipeline | Fully on-device: DexScreener polling → spike detection → Birdeye risk → OpenRouter narrative |
| Wallet | `@solana-mobile/mobile-wallet-adapter-protocol-web3js` |
| Swap | Jupiter API |
| RPC | Helius |
| Market data | DexScreener (primary) + Birdeye (risk screen) |
| AI | OpenRouter |
| Notifications | Expo Notifications (local — server-push is the post-hackathon upgrade path) |
| State | React context + AsyncStorage (feed, snapshot baseline, risk cache, settings) |

## Testing

```bash
pnpm test      # vitest — spike detector thresholds, baselines, pruning, cap
pnpm lint      # eslint
npx tsc --noEmit
```

## Design

Dark terminal / ticker aesthetic reused from [usepulse-two.vercel.app](https://usepulse-two.vercel.app)

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

## Project Structure

```
app/                  # Expo Router screens
components/           # UI components (cards, risk badge, token logo)
lib/                  # Pipeline, detectors, API clients, storage
lib/__tests__/        # Unit tests (spike detector)
hooks/                # Custom hooks + providers
constants/            # Theme, colors matching Pulse aesthetic
docs/                 # Scope discipline + submission notes
```

---

Built by [@NathanOyewole](https://github.com/NathanOyewole)