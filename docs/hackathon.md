# CLOCK IN Submission Pack — Pulse Pocket

*Everything needed to submit, in one place: form copy, demo script, deck
outline, and judging/test instructions. Facts here are the real build — see
`docs/scope.md` for what is deliberately NOT claimed.*

**Deadline: Oct 8, 2026** · Submit at https://solanamobile.radiant.nexus/

## 1. Project title + tagline (form field)

**Pulse Pocket** — *Real-time Solana narrative intelligence, in your pocket,
with wallet-native action.*

## 2. Short description (≈50 words, form field)

Pulse Pocket turns live Solana momentum into readable narratives. It polls
DexScreener for price/volume spikes, rug-screens the mover on-chain via
Birdeye, reads attention before price moves (boost velocity + buy/sell
pressure), and writes a short plain-language story — then one-taps the whole
thing into a wallet-native Jupiter swap. All on-device, no backend. Alerted
by a native background task even with the app killed.

## 3. Full description (paste-ready for the form)

Thesis: **attention precedes liquidity — narratives move before price does.**

Pulse Pocket is a single, real vertical slice of a larger "Pulse" vision
(Narrative Radar, wallet intelligence, attention heatmaps, alert engine).
Everything in this build works live, on the phone, with no mocked metrics.

- A 90-second on-device loop polls the watchlist from DexScreener and detects
  momentum spikes — price (≥8% 1h / ≥25% 24h) and volume (≥2x a rolling
  baseline) — against a short history stored in AsyncStorage.
- Every spike is rug-screened on-chain via Birdeye: mint/freeze authority,
  mutable metadata, top-10 holder %, creator %, liquidity, age. Not LLM-guessed
  — real on-chain safety.
- An attention-proxy backs each narrative with forward-looking data: DexScreener
  boost velocity (how fast a token is being boosted, delta vs the last snapshot)
  plus Birdeye 1h buy/sell/unique-wallet counts. This is the "attention
  precedes liquidity" claim made measurable, not decorative.
- An LLM (OpenRouter, 5 rotating free models) writes a short readable blurb
  from the spike + risk + attention facts. When the free quota is exhausted the
  app degrades to a *labeled* template, never a fabricated story.
- Alerting is genuinely mobile-native: a TaskManager + BackgroundFetch task
  polls the same detector while the app is fully killed (~15-min Android floor,
  OS-scheduled on iOS) and fires a real notification. Tapping it deep-links
  straight into that pair's detail screen.
- Action is one tap: Mobile Wallet Adapter connect + a Jupiter swap executed
  on-device, right on the narrative card. No leaving the feed.
- All of it is on-device: AsyncStorage for feed/caches/settings. No server,
  no backend to stand up, nothing to break during judging.

Honesty: the broader Pulse platform (wallet intelligence, heatmaps, social
ingestion, real-time remote push) is the roadmap and is stated as such — it is
not built, not claimed, not faked.

## 4. Demo video script (≤3:00)

Deliver:**no third-party music, all real app footage, English voiceover or
captions.** Record on an Android device with the internal-release build.

| Time | Shot | Action & narration (VO) |
|------|------|--------------------------|
| 0:00–0:15 | Cold open | Title card on the phone screen: *"Attention precedes liquidity. Narratives move before price does."* VO: "Pulse Pocket: real Solana narrative intelligence, live on your phone." |
| 0:15–0:30 | Welcome | Welcome screen with LISTEN / UNDERSTAND / ACT / STAY ALERTED. VO: "Watch live momentum, understand it in plain language, act in one tap, and stay alerted — even with the app closed." |
| 0:30–0:50 | Live feed | A narrative card on the feed. Point at the spike badge (VOLUME SPIKE / PRICE MOVE), the headline and the risk badge. VO: "Here's the feed. A pair spiked; Pulse Pocket wrote it into a story, and rug-screened it on-chain." |
| 0:50–1:10 | Attention line | Read the fact-line in the blurb (boost velocity / buy-sell pressure). VO: "This isn't narration after the fact — it reads attention *arriving*: boost velocity climbing, buyers stepping in before the move finished." |
| 1:10–1:30 | Pair detail | Tap the card → detail screen: live price, 1h/24h, risk screen, liquidity, chart link on DexScreener. VO: "One tap in. Rug-screen straight from on-chain data." |
| 1:30–2:10 | Background alert | The money shot. Background the app / lock the phone, cut to the phone on a table, alert fires: *"SPIKE: VOLUME"*. Tap it — deep-links back into that exact pair's screen. VO: "Now kill the app. The detector doesn't sleep — a native background task fired a real alert, and tapping it brings us straight back to that token." |
| 2:10–2:40 | Wallet action | Connect a Solana Mobile wallet (MWA), hit **Swap** on the card, show the confirmed signature. VO: "And the payoff: connect your wallet, one tap, a real swap executed on-device through Jupiter. No leaving the feed." |
| 2:40–3:00 | Close | Back to feed + tagline. VO: "Pulse Pocket is one real slice of the Pulse vision — the rest is the roadmap, and we're saying so out loud. Attention precedes liquidity. What narratives are moving right now?" End on disclaimer: "Not financial advice." |

## 5. Pitch deck outline (5–6 slides)

1. **Title** — Pulse Pocket + one-line thesis.
2. **Problem** — Hype cycles move before price; retail finds out after. Noise > signal; most alerts are web apps wrapped in a shell.
3. **Solution** — Narrative Radar on your phone: detect → understand → act → alerted. Show the loop graphic.
4. **Proof** — The real pipeline (DexScreener → spike detector → Birdeye rug-screen + attention proxy → OpenRouter → feed) and the native background alert. Screenshots + a QR to the demo video.
5. **Mobile-only** — MWA connect, on-device Jupiter swap, Android first for Seeker. No server, instant-on, works offline-ish.
6. **Roadmap (stated as roadmap)** — Smart-wallet intelligence, attention heatmaps, social ingestion, real-time remote push, Solana dApp Store listing. "We shipped the one slice that can exist on a device today."

## 6. Repo / testing instructions for judges

- Repo: https://github.com/NathanOyewole/pulse-pocket (branch `main`)
- Build: `pnpm install` → `pnpm prebuild` → `pnpm android` (dev build; MWA
  **requires** a development build, not Expo Go). Or install the submitted
  internal-release APK directly.
- Env keys (`.env`, four): `EXPO_PUBLIC_OPENROUTER_API_KEY`,
  `EXPO_PUBLIC_HELIUS_API_KEY`, `EXPO_PUBLIC_BIRDEYE_API_KEY`,
  `EXPO_PUBLIC_JUPITER_API_KEY`. The app degrades gracefully if missing
  (labeled template narrative, hidden risk badge) — DexScreener needs no key.
- Pipeline: feed auto-polls every 90s; pull-to-refresh forces a cycle.
- Alert floor: Android WorkManager ≈ 15 min; in-app narrative notifications
  fire instantly while the app is open.
- Cleanup/strays: `.stocksh_demo.json` etc. are from sibling projects — ignore.

## 7. What NOT to claim on submission day

- No server-side pipeline, Supabase feed, or cron (roadmap).
- No "real-time" remote push — native background alerts are the shipped path.
- No smart-wallet clustering / heatmaps / social ingestion (roadmap).
- The landing page (https://usepulse-two.vercel.app) is brand/aesthetic only.

*Reminder: rebuild the internal-release APK after any code change so the
submitted binary contains the current code (e.g. the notification deep-link in
`app/_layout.tsx`).*