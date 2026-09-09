# Pulse Pocket

**Real-time Solana narrative intelligence, in your pocket, with wallet-native action.**

Built for **CLOCK IN** — Solana Mobile Hackathon (Sept 8 – Oct 8, 2026)

> Attention precedes liquidity. Narratives move before price does.

## What it does

1. Polls live Solana token price/volume data (DexScreener)
2. Detects momentum spikes against rolling baseline
3. Uses LLM (OpenRouter) to generate short readable narrative blurbs
4. Surfaces narratives as a swipeable card feed on mobile
5. Push notifications on high-momentum events
6. One-tap wallet connect + Jupiter swap directly from a narrative card

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (dev build) |
| Wallet | `@solana-mobile/mobile-wallet-adapter-protocol-web3js` |
| Swap | Jupiter API |
| RPC | Helius |
| Market data | DexScreener (primary) + Birdeye (backup) |
| AI | OpenRouter |
| Backend | Supabase (Postgres) |
| Scheduling | Vercel Cron |
| Notifications | Expo Notifications |

## Design

Dark terminal / ticker aesthetic reused from [usepulse-two.vercel.app](https://usepulse-two.vercel.app)

## Getting Started

```bash
git clone https://github.com/NathanOyewole/pulse-pocket.git
cd pulse-pocket
pnpm install

# Important: use a development build (not Expo Go)
pnpm prebuild
pnpm android
```

## Project Structure

```
app/                  # Expo Router screens
components/           # UI components (cards, feed, etc.)
lib/                  # Solana, API, utils
constants/            # Theme, colors matching Pulse aesthetic
hooks/                # Custom hooks
```

## Timeline (29 days)

See the full build plan in the original Pulse Pocket spec.

---

Built by [@NathanOyewole](https://github.com/NathanOyewole)
