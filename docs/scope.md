# Scope Discipline — Pulse Pocket

*Working note for the submission copy. What this hackathon build actually claims — and what it deliberately doesn't.*

## The one-line pitch

**Narrative Radar for Solana, live on a phone, wallet-native, act-in-one-tap.**

Pulse Pocket is the **Narrative Radar** subsystem of the Pulse vision
(behavioral intelligence infrastructure for internet-market attention),
shipped as a thin, real, mobile-native vertical slice for CLOCK IN.

## Why one subsystem and not five

The full Pulse vision — Narrative Radar, Smart Wallet Intelligence, Attention
Heatmaps, AI Market Briefs, Realtime Alert Engine, and the compounding
behavioral graph — is a multi-year platform. In 29 days it cannot exist
for real, and **judges test what exists, not what's pitched.**

Pulse Pocket makes the scoping honest:

- **One signal type:** price/volume momentum on Solana tokens, evidenced by a
  live attention-proxy (DexScreener boost velocity + Birdeye buy/sell pressure)
  that backs each narrative — not a second shipped subsystem.
- **One data source + one risk source:** DexScreener (live quotes) +
  Birdeye (rug-screen).
- **One action:** one-tap swap via Jupiter — wallet-native, no leaving app.
- **One surface:** a mobile card feed with native background alerts.

Everything else from the Pulse platform is **stated roadmap, not built
feature** — brand, thesis ("attention precedes liquidity"), and the dark
terminal design language carry over; the fantasy backend does not.

## What IS real (nothing mocked)

- Live polling of Solana pairs from DexScreener's public API
- Spike detection against a rolling on-device baseline (AsyncStorage)
- On-chain rug-screen via Birdeye (mint/freeze authority, top-10 holder %,
  liquidity, token age) — **not** LLM-guessed safety
- Live attention-proxy: DexScreener boost velocity (delta vs. previous
  snapshot) + Birdeye buy/sell pressure — the "attention precedes liquidity"
  thesis is backed by real forward-looking data, not copy
- LLM narrative generation via OpenRouter, with a transparent template
  fallback when the free quota is exhausted (the fallback is *labeled*, not
  presented as a model output)
- Native background spike alerts (TaskManager + BackgroundFetch): real device
  notifications even with the app fully killed — no server involved
- Solana Mobile Wallet Adapter connect + Jupiter swap executed on-device
- Push notifications for in-app narratives while the app is running

## What is NOT built here (stated as roadmap in pitch, never claimed live)

- Smart-wallet clustering / wallet intelligence
- Attention heatmaps / social ingestion (X, Telegram, Discord)
- AI market briefs / alert engine
- Server-side pipeline, Supabase feed store, Vercel cron
- Real-time remote push (Expo Push service / Supabase): instant, cross-device
  push needs a server — the post-hackathon upgrade path. The native background
  task covers on-device alerts meanwhile

## Judge narrative

> "We took one real idea from the Pulse platform — attention precedes
> liquidity — and shipped the one slice that can exist on a device in 29
> days: live narrative momentum, screened for risk, with one-tap wallet-
> native action. The rest of the platform is the roadmap, and we say so."

## Facts that back this up

- Primary data path is on-device: DexScreener → spike detector → Birdeye →
  OpenRouter → feed. No mocked metrics anywhere.
- Mobile Wallet Adapter + Jupiter = $10K Solana Mobile Stack bonus-prize fit.
- Risk screen is real on-chain data — a differentiating answer to the
  "LLM hype engine" critique of AI crypto feeds.