# Veltravia Wallet

A self-custody crypto wallet for Android and iOS. Built to the standards of
Trust Wallet: React Native + Hermes on the frontend, Trust's open-source
Wallet Core (C++) for all cryptography, and a domain-swappable hosted backend.

## Architecture

```
┌─────────────────────────────────────────────┐
│ React Native (TypeScript, Hermes)           │
│  src/screens      UI (17-screen v1 map)     │
│  src/navigation   5 tabs: Home/Markets/    │
│                    Swap/Discover/Settings   │
│  src/theme        Veltravia design tokens   │
│  src/config       env + chain registry      │
│  src/core         secure storage, wallet    │
│  src/services     API + AI clients          │
├─────────────────────────────────────────────┤
│ Wallet Core (C++, via JNI bridge)           │
│  BIP39 mnemonic · BIP44 derivation · signing│
├─────────────────────────────────────────────┤
│ Backend (swappable domain)                  │
│  prices · balances · tx history · relay ·    │
│  hosted AI assistant (WebSocket streaming)  │
└─────────────────────────────────────────────┘
```

## Security invariants

1. **Seed phrases never leave the device.** They live in the OS keystore
   (Android Keystore / iOS Keychain) via `react-native-keychain`, encrypted,
   accessible only after device unlock. No server ever sees them.
2. **All signing is local.** The backend relays signed transactions only.
3. **Money is never a float.** Amounts are bigint strings end to end.
4. **Testnet-first.** v1 runs on Sepolia / BSC testnet / Polygon Amoy. The
   mainnet flip is a config change, verified in QA before release.

## Domain-swappable backend

`src/config/env.ts` is the only place URLs exist. Build-time env vars
(`.env`, CI secrets) control:

| Variable         | Purpose                        |
|------------------|--------------------------------|
| `ENV`            | development/staging/production|
| `API_BASE_URL`   | HTTPS gateway                 |
| `WS_BASE_URL`    | WebSocket streaming (AI, live)|

Moving to Veltravia's own `.com` infrastructure = changing these values.

## Build

GitHub Actions (`.github/workflows/`):
- `android.yml` — release APK on every push to `main`, published as a run artifact
- `ios.yml` — unsigned archive, manual trigger (signing setup pending Apple account)

```bash
# local development
npm install
cp .env.example .env
npm run android   # requires Android SDK
npm run ios       # requires macOS + CocoaPods
```

## Features (current build)

- **Onboarding & security:** create/import wallet, passcode with biometric unlock (system BiometricPrompt), single top-level lock screen that also hides every open sheet (`AppModal` + `appLockState`), recents-preview blanking.
- **Wallets:** multiple wallet instances, each with its own AI chat history, security password and wallet lock.
- **Home / Markets / Settings / Activity:** balance card, portfolio, market list, filters with shimmer skeletons.
- **Receive & Share:** 33x33 QR with centered logo, in-sheet "Share Via" grid, QR attached to the system share sheet.
- **Veltravia AI:** hosted assistant (OpenRouter, streaming) with a Trust-style persona, per-wallet encrypted conversation memory and cross-chat recall, copy/delete of messages and chats, tappable screen-shortcut buttons, wallet lock/unlock and transfer proposals. Money safety is deterministic: the model only proposes; every transfer is validated locally and needs biometrics or passcode.
- **Discover (new):** a full-screen route above the tabs (the floating tab bar is not shown; the X in the search bar returns to Home), one screen with a Trending header and a Tokens / dApps capsule that pages horizontally. A Recents strip sits above the pager (hidden until a coin or dApp is tapped, survives page switches, "Clear all"). Bottom search bar with Paste (explicit-tap clipboard read), clear and close; searching shows a 3-row shimmer loading state, then All / Tokens / Predictions / dApps results. Type sizes follow the app's own scale (rows 15/12, section titles 18, controls 44px) so Discover matches Markets and Settings. Data comes from `src/services/discoverData.ts`, the single swap point for the live API.

- **In-app browser:** every link in the app opens in the full-screen in-app browser (`openInBrowser()` is the single entry point). Two chrome modes, like Trust: **web mode** for normal links — light grey top bar with a plain back arrow (page history, closes when it runs out), green lock + centered domain, a 3-dot menu whose single item is **Open in browser** (hands the page to the system browser), and a thin bottom bar with plain back / forward / reload; **dApp mode** for Discover dApps — grab handle, circular close X, tabs counter, favorites heart, tabs pill, green progress line, full menu (Network, Request Desktop/Mobile Website, Share, Fullscreen) and the disclaimer card on open. Both modes: only http(s) loads (javascript:, file:, intent:, data: refused), no history persisted, tap the domain to copy the link, bars auto-hide on scroll down and return on scroll up, always visible at page edges. Request Desktop Website switches to a real desktop layout (desktop UA + forced 1280px viewport, WebView remounted). Built on `react-native-webview`.

## Testing

`npx jest`: 15 suites / 75 tests, including an App smoke test mounting the full navigator, search-feed and clear-button behavior, custom token/network validation, the disclaimer wording, scan-result delivery, and the browser web/dApp chrome split. `jest.setup.js` mocks native modules (NetInfo, Keychain, Config, LinearGradient, WebView, vision-camera, image-picker); `jest.config.js` transforms React Navigation's ESM.

## Tokens, Manage & Import (new)

- **Home:** Tokens and Perps sections under the portfolio panel; every token entry point (row, header, "View all") opens the **Tokens screen** (real tab, floating pill stays mounted).
- **Tokens screen:** back + centered title, shared search pill, full asset list; row tap opens Balance Details. The filter icon opens the Trust-style **Manage sheet** (drag handle, centered "Manage"): **Dust cleaner** ("Convert Dust to Native Token" -> **Select network**: All networks radio default, Popular networks, A-Z, search with Cancel that appears on focus, illustrated "No results found"), **Manage crypto** -> full screen (back, "+" top-right, search, network chip strip, rows with ticker + network chip + persisted toggles that drive the Tokens list; held assets start ON; at the end of the list a blue "Didn't see your crypto? Import" link opens Import crypto), **Hide assets <$0.01 USD** live toggle.
- **Search fields:** one shared `SearchField`; the round grey X shows only while there is text and clears without closing the keyboard. Manage crypto's feed is an A-Z directory when empty and jumps to symbol-prefix matches first when typing.
- **Import crypto (2-in-1):** the "+" opens swipeable Token / Network pages with an animated underline, amber scam-warning banners, outlined fields and a violet pill Import. EVM addresses format-checked (0x + 40 hex), decimals 0-36, http(s) URL validation; errors only after tapping Import; imported tokens list in Manage crypto (enabled). Auto-fill, network picker sheet, Chainlist and QR scan are pending the backend feed / camera.
- **dApp disclaimer:** opening a dApp from Discover shows the centered disclaimer card (book illustration, bold "Disclaimer", approved Veltravia wording, circular "I accept the Terms of Use" checkbox with Terms of Use in brand violet, Cancel / Confirm pills). Confirm is disabled until the checkbox is ticked; Cancel or X closes the tab and returns to Discover.
- **Settings & Perps:** Settings moved to the Wallets drawer gear; bottom nav gained a Perps tab (infinity icon; the Markets tab glyph is the rounded trend line, muted untapped, violet on the grey pill when tapped). New Settings groups: Address Book, Security, Notifications, Preferences, Perps (educational "Coming Soon"), Community (X, Telegram, YouTube, TikTok only) and About.

## QR scanner (new)

Every scan icon (Home header scan, Import crypto address scan) opens the full-screen **Scan QR code** overlay: live camera dimmed except a clear center window with four rounded white corner brackets, translucent circular header buttons (close X, gallery, flashlight/torch toggle), centered white title and the home gesture bar. A detected QR returns straight into the caller (Import crypto fills the Address field). Gallery picks a photo and decodes the QR **locally** (jpeg-js + jsQR, nothing uploaded). If camera permission is denied the scanner shows its own grant screen. Adds `react-native-vision-camera` + `react-native-image-picker`, CAMERA/FLASHLIGHT permissions (Android) and NSCameraUsageDescription / NSPhotoLibraryUsageDescription (iOS).

## Perps (new)

The Perps tab is the real Perps home (Trust parity), no longer the educational placeholder (that now lives at Settings > Perps as `PerpsAboutScreen`).

- **Separate Perps balance.** Confirmed from the Trust APK: perps trades from its own account ("Perps balance", funded by a dedicated `perps.deposit` flow and returned by Withdraw), not from the main wallet. `services/perpsAccount.ts` holds that account per wallet (multi-instance rule), persisted in encrypted storage. v1 tracks available balance, margin in positions and unrealized P&L.
- **Two home layouts**, chosen by that balance. **Not funded:** the "Deposit to fund your first position" hero with Ijezie's gold 3D infinity mark (`src/assets/perps-infinity-gold.png`) and a violet Deposit button. **Funded:** the hero disappears and a balance header takes its place: "Perps balance" total, unrealized P&L (green/red), Available balance row, Deposit and Withdraw buttons; tap the balance to hide it.
- **Deposit / Withdraw screen** (`PerpsDepositScreen`): moves stablecoin between the main wallet and Perps; Max button, amount validated against the source balance, over-limit message. Real settlement goes through `api.veltraviawallet.com` once the Wallet Core signing bridge ships.
- **Header and lists:** history and gear circles on the left, centered "Perps", search on the right. Sections Popular, New, Crypto, Stocks, Forex and Meme, each row a logo, symbol, leverage pill, 24h volume, a green/red sparkline, price and 24h change, with Trust's price precision. Floating green Long / red Short pills sit above the tab bar. Market data is a local dataset (`perpsMarkets.ts`) pending the backend feed.

### Settings > Perps menu

Settings > Perps opens a plain list (Trust parity): **Hyperliquid** and **Aster** (venue rows; both open the Perps tab for now, live trading waits on the Wallet Core signing bridge), **How perps work?** (the educational screen) and **Contact support**. Contact support hands `https://help.veltraviawallet.com` to the **system browser** via `Linking.openURL`; it deliberately does not use the in-app browser (`openInBrowser`). The help site itself is a separate future build, modeled on Trust's help center: "How can we help you" with FAQ search, a Get Support card with "Ask our Chatbot", Trending topics, topic cards, and a floating chat widget (Home / Help / Messages).

### Floating tab bar (Trust-parity polish)

The pill now uses Trust's exact treatment: a milk interior (`#FAFAFB`) wrapped in a tiny dark-gray hairline (`#D1D1D4`) in light mode (deep navy `#07101E` with a faint hairline in dark). The active-tab indicator is a compact fully-rounded pill (48x32, `#F0F0F2` light / `#1D2133` dark) and the icon groups sit inside the capsule's straight section, so the rounded ends curve around empty space instead of the indicator rectangle poking past the capsule edge on narrow screens. The raised Swap button uses the same milk surface and hairline.

### Perps: fresh-open loading state and Trust balance layout

The Perps balance fetch runs **once per fresh app open**. The first time the tab mounts, the screen shows Trust's loading state (shimmer skeletons for the balance figures inside the live layout); once the fetch resolves it settles on the real state and every later visit renders instantly from the cached account. No balance → the deposit hero. Balance → the balance header.

The funded layout now matches Trust's design exactly:

- **Header circles:** solid dark-gray circles with white icons (light mode).
- **Balance area:** "Perps balance" label, large total (tap to hide), unrealized P&L in green/red.
- **"Available balance" pill** (`#F2F2F2` light / navy dark): label with a chevron that expands the breakdown (margin in positions, unrealized P&L), the available value, and two circular action buttons on the right — plus (Deposit) and minus (Withdraw) in Veltravia violet, opening the deposit/withdraw sheet.
- While loading, the same pill renders with skeleton blocks where the numbers will be.
- Long / Short floating pills stay above the tab bar; market lists appear once loading finishes.
- **Action colors (Trust depth):** Deposit (and the deposit/withdraw sheet CTA) use the app violet darkened to Trust's button depth (`#5147E6`, from the lighter `#6C63FF`); Long is deep green `#158444` and Short deep red `#D63232`, matching Trust's measured tones.

### Perps venue screens (Hyperliquid / Aster)

Tapping **Hyperliquid** or **Aster** in Settings > Perps now opens the venue's own screen (Trust parity):

- **Header:** the venue's brand mark sits next to the centered name (shared marks in `components/PerpsVenueMarks`).
- **"Show in markets" toggle** (deep-violet `#5147E6` track): persisted per venue in encrypted settings and live-wired to the Perps home lists — turning a venue off filters its markets out of Popular / New / Crypto / Stocks / Forex / Meme, and fully-emptied sections hide.
- **Aster only: "Asset mode"** with the current mode as subtitle ("Single-asset mode" default); tapping opens a bottom-sheet chooser between Single-asset and Multi-asset mode (persisted).
- **Fees / Trading rules:** open the venue's documentation in the in-app browser (Web mode).
- Preferences survive restarts (`services/perpsVenues`, loaded at app start alongside the perps accounts).

### How perps work? (instructions carousel)

Settings > Perps > **How perps work?** opens a six-step swipeable guide (Trust parity), replacing the old text list:

1. Introducing Perps, 2. What are Perps?, 3. Use leverage wisely, 4. Go long or short, 5. Protect your position, 6. Start trading in minutes.

- Segmented progress bar at the top: check = done, ring = current, empty = ahead, linked by a line that fills as you advance.
- **Next** (deep violet `#5147E6`) advances; on the last step it reads **Got it** and closes. **Skip** closes from any step. Swiping sideways also moves between steps.
- All six steps are illustrated with the generated art in `src/assets/perps-guide/` (filenames are documented in that folder's README).
- Step 6 uses Veltravia's own token names (USDT, BNB, VWT).
- The Perps home gear icon opens the Perps settings menu; the history (timer) icon opens the Activity screen.

## VWT token (new)

The official token now has a contract and logo, ready to deploy:

- `contracts/VeltraviaWalletToken.sol` — ERC-20, `Veltravia Wallet Token` / `VWT`, 18 decimals, fixed supply of 1,000,000,000 minted once to the deployer. No mint/pause/owner powers: immutable after deploy. Compiles clean on solc 0.8.24 (ABI in `contracts/VWT.abi.json`).
- `contracts/README.md` — deploy guide (Remix, testnet first) and the pre-mainnet decision list (chain, supply, verification).
- `src/assets/vwt-logo.png` + `vwt-logo-small.png` — VWT coin logo: gold infinity on deep navy with the violet→cyan glow, plus a 256px in-app copy.
- Deploying to a live chain is a manual step (needs a funded wallet); once the address exists it goes into the app's token metadata so VWT displays natively.

### Skeleton shimmer (Trust parity)

The skeleton primitives now shimmer like Trust's recording: on top of the 1→0.6→1 opacity pulse, a soft white highlight band sweeps across every block every ~0.8s (measured from Trust's screen recording), one shared phase keeping all blocks in step. The band is subtler in dark mode. Because it lives in the shared `SkeletonBlock` (src/components/Skeleton.tsx), the Perps balance skeleton, Activity rows and every other skeleton get the same loading look.

### Perps balance loading time (Trust parity)

Trust doesn't resolve the Perps balance instantly: measured from a screen recording, its skeleton stays up about **4.3 seconds** on a cold open before the real balance appears. Ours now mirrors that: on a fresh app open the skeleton holds while the providers' balances are looked up (`SIMULATED_LOOKUP_MS = 4300` until api.veltraviawallet.com serves the real lookup, at which point the real response time takes over). `MIN_SKELETON_MS` (600ms) stops a very fast answer from flashing. Leaving and re-entering the tab mid-load does not restart the wait, and every later visit is instant from cache.

### Perps Withdraw sheet (Trust parity)

The "−" button on the Perps home opens a tall bottom sheet over the Perps screen: X + "Withdraw", the typed amount (with "≈ $" below), a **Withdraw from** row (provider + its balance), a **Receive** row (USDC + network), a percent slider (0/25/50/75/100 stops, drag shows a % bubble), an in-sheet keypad, and a **Slide to Withdraw** control.

- **Balances are per provider** (Hyperliquid, Aster). Deposits credit Hyperliquid by default; the Perps home still shows the combined total.
- **Not enough balance**: as soon as the typed amount is above the *selected provider's* balance, a red "Not enough balance" appears and the slide stays locked. A provider holding $0 trips it on the first digit.
- **Money at the other provider doesn't count.** The user taps *Withdraw from* → **Select provider** (Hyperliquid / Aster, each with its balance) and picks the one that has funds. The sheet opens on a funded provider automatically.
- **Receive** opens **Select network** (Arbitrum, Ethereum, Base, Optimism, BNB Smart Chain, Polygon, Avalanche, Solana) with the "We'll deposit USDC to your wallet…" note.
- Settlement through api.veltraviawallet.com arrives with the Wallet Core signing bridge; until then the slide updates the local Perps account.

### Perps "Filter" sheet (Trust 10:38 screenshot)

The Perps Activity screen's filter-lines button now opens a dedicated **PerpsFilterSheet** (the wallet Activity keeps its own FilterSheet). Bottom sheet over the ~20% scrim, same envelope as Trust (rounded top corners, up to 80% of the screen, content-sized). Header: X in a light circle, centred bold "Filter", muted "Reset" (inactive until the draft is dirty). Sections, 24-30px apart: **Provider** single-select chips with the Hyperliquid/Aster marks; **Assets** row with a muted "Select >" (picker lands with live trading data); **Type** multi-select chips (Order=doc, Trade=card, Transfer=swap arrows); **Show funding payment** label + the 34x22 toggle (off by default); **Status** multi-select chips (Completed/Submitted/Processing/Failed); **Date** single-select chips (7d/30d/90d/Custom). **Full walkthrough verified against the 10:44 screen recording:** chips use Trust's exact palette — idle #EFEEF1 with muted grey text, SELECTED = darker grey #CECED6 with near-black text (no border, no tint). "Reset" is pale grey when clean, near-black when dirty (not brand-coloured). "Show results" is pale #F8F7FA with #C8C9CE text when clean, solid brand when dirty. The Assets "Select" is grey with a near-black chevron.

**Date > Custom:** the sheet grows and shows Start / End fields (rounded #EFEEF1, small grey label, bold "Oct 21, 2026 10:44 AM" value, grey calendar icon), seeded now-7d -> now. Tapping a field opens the native Android Material date dialog then the clock (new DateTimePickerModule.kt, registered in SecurePackage), exactly what Trust shows. Start is clamped to End. Applying filters puts a ~7dp brand dot on the Activity header's filter-lines circle (and it clears on Reset).

### Activity loading/failure states unified (Trust 10:22 screenshot)

The **Perps Activity screen** carries this loading/failure pattern (the main wallet Activity screen keeps its own existing state):

- **Failure state:** Trust's cog illustration is replaced everywhere with Ijezie's sad no-Wi-Fi robot (`src/assets/activity-error-robot.png`, transparent background so one asset serves light and dark). Copy matches Trust 10:22 exactly: a single grey line "Failed to load activity" and a 288x59 **Retry** pill (no headline, no error caption). Retry re-runs the full load.
- **Skeleton:** the shared `Skeleton` primitives (used by both Activity screens, Perps home session load, Discover search, ReceiveSheet) carry Trust's two-part animation: the 700/600ms opacity pulse plus the moving light band sweeping every block every 0.8s.
- **Pull-to-refresh:** dragging the list pops the native spinner AND swaps the screen to the shimmering skeleton "searching for any activity" until the fetch settles, then returns the list (or the failure view if the phone is offline). The skeleton branch keeps the RefreshControl attached so the spinner survives the swap.

### Perps Activity screen (Trust 10:21 screenshot)

The Perps history icon (home round-timer + market page history) now opens a **dedicated Perps Activity screen** (separate route `PerpsActivity`, not the wallet Activity). Built on the same pattern as the wallet screen: 36dp header circles with back / centred "Activity" / filter-lines button, shared skeleton on load, then the empty state with the existing Veltravia no-activity robot illustration, "No activity yet" and "Your transactions will appear here"; "Show older activity" pill with state-driven auto-hide; the Filters sheet. Offline (real NetInfo probe) shows the shared error state (satellite art, "Something went wrong", 288x59 Reload pill, "Request timed out") — to be refined against Ijezie's upcoming offline recording. 205 tests.

### Perps market page: trend chart, candle illustration, real candle view (Trust 10:08 recording)

The normal market view now has the same three-step chart flow as Trust:

1. **Trend chart (default).** A line + pale-gradient area chart with the **trend-arrow** icon and the ranges `1H 1D 1W 1M 1Y YTD ALL` (ALL spans ~4 years; no interval picker here). Colour follows the range: green when up, red when down. A solid dot sits on the newest point.
2. **Scrub.** Touch-down scrubs immediately (no long-press): the area fill disappears, the line stays coloured up to the finger and turns **grey after it**, a haloed dot follows the finger with a light haptic tick per point, and the **header changes** to that point's price, its change since the start of the range and the date ("+$1,579.0 (1.98%) Oct 27, 2:30 PM"; multi-year ranges show "Mar 3, 2024"). Release snaps everything back to the live price.
3. **Tap the arrow** -> the compact **candle illustration** (non-interactive) and the icon **switches to the candle icon**; the six candle ranges and the `30m` interval picker appear. **Tap the candle icon** -> the **real candle view** (the TradingView Advanced screen with Indicators / Volume / Return). The "Advanced" pill on the illustration is a second route into the same view. Inside the real view the arrow still toggles candle <-> line on the TradingView chart.

Files: `src/services/trendEngine.ts` (series, scrub math, stamp/change formatting), `src/components/TrendChart.tsx`, `CandlesIcon` in `icons.tsx`, screen wiring in `PerpsMarketScreen.tsx`. 199 tests. The scrub behavior was derived from pixel analysis of the recording (fill vanishes, grey tail, dot tracking) because Trust's Hermes bundle keeps names (`ChartScrubDot`, `ScrubOverlay`, `isMarketChartMode`) but not readable logic.

### Perps: market navigation is a proper back-stack (Trust 09:42 flow)

Every market tap PUSHES a new market page instead of replacing the current one (related markets used to `replace`). Back walks the full history in order: open BTC from the list -> tap ZEC in Related markets -> back returns to the BTC page -> back again returns to the list/home the first market was opened from. Each visited page keeps its own state (Advanced mode, favorites) because it stays mounted in the stack. 183 tests.

### Perps market page: the REAL TradingView chart (step 2, part 2)

The Advanced chart is now the genuine **TradingView Advanced Charts library (CL v32.1.0)**, exactly as Trust Wallet ships it:

- **Extracted from Trust's APK** (404 files, 10.2 MB) into `android/app/src/main/assets/charting_library/` — the same path Trust stages it at, so the WebView loads `file:///android_asset/charting_library/index.html` (Trust's own host page, copied verbatim).
- **`src/services/tvBridge.ts`** (pure logic, 15 tests) implements Trust's bridge protocol: the page announces `ready`, RN answers `init` (symbol, exchange, interval, theme, pricescale, volume, Veltravia colors), the library pulls history through `barsRequest`/`barsResponse` (ids matched one-to-one), and RN pushes `setResolution`, `setChartType`, `theme` and `updateTick` as the control bar and live price move. One series per interval with a frozen clock, so panning back pages a consistent walk; `meta.noData` marks the end of history.
- **`src/components/TradingViewChart.tsx`** is the thin RN WebView wrapper: file access + universal access enabled (the library's same-origin iframe needs it), `onShouldStartLoadWithRequest` keeps the WebView on file:// only, remote navigation is impossible.
- **Market page**: the normal view keeps the lightweight preview chart; Advanced swaps it for the real chart (height ~1.05x width). The timeframe chips, interval picker, line/candle toggle, volume Manage and theme all drive the library live. TradingView's own pan/zoom/crosshair/gestures are native inside the WebView.
- The TradingView logo button still opens tradingview.com in the system browser (Trust does this too), and the library's attribution stays in-pane as required.
- Bars still come from `candleEngine` (deterministic, ends at the live price) until api.veltraviawallet.com serves real OHLC.

### Perps market page: candle chart and Advanced mode (step 2)

The chart is now a real interactive candlestick chart (`CandleChart` + pure maths in `services/candleEngine.ts`, 21 + 7 tests):

- **Candles** with green/red bodies and wicks, a dashed purple last-price line and tag, a right **price axis** (nice round ticks, bold at the round values) and a bottom **time axis** (HH:mm, bold day number at midnight).
- **Ranges** 1H, 1D, 1W, 1M, 1Y, YTD each open on Trust's interval (1D -> 30m, 1W/1M -> 4h, 1Y -> 1d); the **interval picker** (30m with up/down chevrons) lets you choose 1m, 5m, 15m, 30m, 1h, 4h or 1d. The leading **trend icon** toggles candles <-> a close-price line.
- **Advanced** (the outlined button) switches the page to the full chart mode seen in the recording: About/Stats/Related are hidden; the chart grows tall; a **volume histogram** appears; an **Indicators** card (Volume, **Manage** toggles it) sits below; the TradingView mark opens tradingview.com in the system browser; **Return** goes back; the hex icon is chart settings. Long/Short and "Provided by" stay.
- **Gestures in Advanced**: one finger pans, two-finger pinch zooms around the fingers, and the **price scale re-fits** to what is visible (so zooming in tightens the axis, as in the recording). Long-press shows a **crosshair** with an OHLC readout; release hides it.
- Candles are generated deterministically per market + range + interval and always end at the live price, until api.veltraviawallet.com serves real OHLC. No gesture library: PanResponder-style responder events only.

### Perps market page (rebuilt from the 2026-10-28 screenshots)

Tapping any market (Perps home, Search market, Watchlist, a Recent card, or a Related market card) opens its market page:

- **Header**: back; star (adds/removes the favorite that feeds the star tab + Watchlist), bell (alert placeholder), history.
- **Asset row**: logo, symbol + leverage pill, full name; price and 24h change on the right.
- **Chart**: candlesticks (deterministic per market + timeframe until the OHLC feed lands) with a dashed last-price marker, and the outlined "Advanced" button at the chart's bottom-left.
- **Timeframes**: 1H, 1D (active), 1W, 1M, 1Y, YTD, 30m▾.
- **About <name>**: AI-written description (about one paragraph per known market; an honest generic text for the rest), 3-line preview with grey "View more"/"View less", and the AI disclaimer when expanded: "This description has been generated by AI. It has been generated for informational purposes only, and should not be taken as financial advice." (src/services/perpsMarketInfo.ts)
- **Stats** card: 24h volume, Open interest, Funding rate (+ timestamp), with "View performance ›". BTC's values mirror Trust's page (1.74B / 3.50B USDC, 0.0013%); others derive from the market's volume until the feed supplies real ones.
- **Related markets**: horizontal cards of same-venue markets with price + change; tapping one replaces the page with that market.
- **Bottom**: Long / Short buttons (Trust deep green/red with arrows) and "Provided by <Hyperliquid|Aster>" which opens the venue screen.
- Long/Short, bell and Advanced show "arrive with live data" toasts for now (trade tickets are a later step).

### Perps favorites, Watchlist and market page (Trust parity)

Favorites are one shared list (`perpsFavorites.ts`) that three places read:

- **Market page** (`PerpsMarketScreen`): opened by tapping any market row (Perps home, Search market, Watchlist, Recents card). Header: back, **star**, bell, history; then symbol + leverage chip, price + 24h change, chart (placeholder line until the candle feed), timeframe chips, About, Stats, Long / Short and "Provided by <venue>". Tapping the star adds/removes the market from favorites. Opening a market records it in Recents.
- **Star tab on Search market**: lists every favorited market (once each). Swipe a row left to reveal the pale-red **Delete** action; tapping it removes the market from favorites (as in Trust's recording).
- **Watchlist on the Perps home**: a "Watchlist" section **above Popular** lists every favorite (same row design, hidden venues excluded). **With no favorites the section does not exist at all** and the home shows Popular first. The market stays in its normal sections too.

Chart, About copy, alerts and the Long / Short order flow arrive with the backend feed and signing bridge; the buttons show a short info toast until then.

### Perps "Search market" (Trust parity)

The search icon on the Perps home opens a full-screen market browser (screen `PerpsSearch`, built from a Trust screen recording):

- **Tab strip** (from Trust's recording): star (favorites), Popular, New, Stocks, Crypto, Pre-IPO, Commodities, FX, Meme. The strip itself scrolls sideways; tapping a tab moves the grey pill and scrolls the strip only as far as needed to reveal that pill (a tab already fully in view leaves the strip where it is). Switching tab vibrates and shows a brief spinner, then that tab's markets. The market list under it is also a horizontal pager, so swiping the content switches tabs too and the strip follows. Crypto, FX, Pre-IPO (ANTH, ANT, OAI, PREDICT, MOONSHOT, PAPER, XTEN, POLYMARKET, OURA) and Commodities (CL, BRENTOIL, SILVER, GOLD, NATGAS, PLATINUM, COPPER, PALLADIUM, BZ, HO) carry the rows from Trust's screenshots; Pre-IPO and Commodities markets are Aster-listed.
- **Filter chips**: "All providers" (picker: All / Hyperliquid / Aster) and "Volume (24h)" (sort picker: Volume, Price change, Price, Max leverage, Name; picking the active option again flips the direction, shown by the arrow).
- **List**: the same rows as the Perps home (logo, leverage pill, volume, sparkline, price, 24h change). Tap the small star on a row (or long-press the row) to favorite it; favorites persist and appear once in the star tab (swipe a row left and tap Delete to remove it), which shows "No favorites yet" when empty. Tapping a row opens its market page.
- **Bottom "Search market" bar**: typing narrows the current tab by symbol. The round X clears the text first; pressed again with an empty box, it closes the screen.
- **Recents row (Trust parity)**: markets you've tapped appear as horizontal "SYM Perps" cards under a "Recents" heading with a violet "Clear all". Tapping a card filters the list to that market. Newest first, capped at 8, persisted (`perpsRecents.ts`); hidden venues drop out of the row too. The row hides entirely when empty.
- **Respects Settings > Perps "Show in markets"**: a hidden venue's markets never appear here either.
- Logic lives in `src/services/perpsSearch.ts` (pure, tested) and favorites in `src/services/perpsFavorites.ts`. The dataset is still the local `PERP_SECTIONS` until the backend feed lands.

### Scanner exempt from the app lock (Trust parity)

When the app lock is on, the QR scanner stays reachable without unlocking:

- The lock screen (passcode) has a **scan icon bottom-left**; tapping it opens the Scan screen while the app stays locked.
- The lock overlay **skips the ScanQr route**: no passcode prompt covers the scanner. Closing the scanner (or scanning and popping) returns to the lock screen — everything else stays gated.
- Safe by construction: a scan opened from the lock screen has no scan target, so a scanned code can only show a toast; nothing (browser, send, wallet data) can be reached while locked.

### dApp disclaimer (rebuilt, Trust parity)

Tapping a dApp in Discover (e.g. Aave) pops the disclaimer **on the Discover screen** — the dApp does NOT open behind it and nothing loads until the user accepts:

1. Tap a dApp row → centered white popup over a dimmed backdrop: X top-right, book illustration, bold "Disclaimer", the approved Veltravia body copy, a circular "I accept the Terms of Use" checkbox, and Cancel / Confirm pills.
2. Confirm is disabled until the box is ticked. Cancel or X dismisses the popup and opens nothing.
3. With the box ticked, Confirm dismisses the popup and only then opens the dApp in the in-app browser.

### dApp disclaimer (removed, pending rebuild)

The disclaimer modal was deleted (2026-10-28): the current look didn't match what Veltravia wants, so dApps open directly with no disclaimer while the screen is redesigned from scratch. The approved body copy is preserved here for the rebuild:

> We do not own, operate, or endorse any third-party dApps or websites. Your use of these platforms is entirely at your own risk. We are not responsible for any losses, damages, or issues arising from interactions with third-party services, including disputed transactions. By using Veltravia wallet, you agree to our Terms of Service. Always verify the legitimacy of dApps and conduct your own research before interacting with them.

The book illustration stays in `src/assets/dapp-disclaimer-book.png` in case the new design wants it.

### Perps Withdraw sheet (Trust parity)

The "−" button on the Perps home opens a tall bottom sheet over the Perps screen: X + "Withdraw", the typed amount (with "≈ $" below), a **Withdraw from** row (provider + its balance), a **Receive** row (USDC + network), a percent slider (0/25/50/75/100 stops, drag shows a % bubble), an in-sheet keypad, and a **Slide to Withdraw** control.

- **Balances are per provider** (Hyperliquid, Aster). Deposits credit Hyperliquid by default; the Perps home still shows the combined total.
- **Not enough balance**: as soon as the typed amount is above the *selected provider's* balance, a red "Not enough balance" appears and the slide stays locked. A provider holding $0 trips it on the first digit.
- **Money at the other provider doesn't count.** The user taps *Withdraw from* → **Select provider** (Hyperliquid / Aster, each with its balance) and picks the one that has funds. The sheet opens on a funded provider automatically.
- **Receive** opens **Select network** (Arbitrum, Ethereum, Base, Optimism, BNB Smart Chain, Polygon, Avalanche, Solana) with the "We'll deposit USDC to your wallet…" note.
- Settlement through api.veltraviawallet.com arrives with the Wallet Core signing bridge; until then the slide updates the local Perps account.

### dApp disclaimer gate (Trust parity)

Opening a dApp shows the disclaimer BEFORE anything loads: until the user ticks "I accept the Terms of Use" and taps Confirm, the WebView stays unmounted, so no request to the dApp leaves the device. Cancel or X closes the tab. Cancel is a filled light-grey pill with violet text; Confirm is a filled violet pill (disabled until the checkbox is ticked), matching Trust's layout.

### Guide navigation (Trust parity)

The "How perps work?" flow now ends like Trust's: step 1's primary button is "Learn more" (scrolls to step 2), steps 2-5 keep "Next", and step 6 shows "Start now" with a "Learn more" link at the bottom. Start now, the bottom Learn more, and Skip all return to the Settings > Perps menu screen (the guide is always opened from it, so back returns there).

## Build status

Android builds via GitHub Actions (`android.yml`). Market, portfolio and Discover data are local datasets pending `api.veltraviawallet.com`; transaction signing awaits the Wallet Core native bridge.

## Roadmap

- **Phase 1 (done):** scaffold — architecture, theme, navigation, security layer, CI
- **Phase 2:** onboarding flow (create/import wallet, seed confirm, PIN), live balances, send/receive, history
- **Phase 3:** hosted AI assistant, Buy flow, Bitcoin (UTXO wave)
- **Next:** live API (prices, balances, Discover trending/search), Wallet Core signing bridge, real token logos
- **v2:** Swap (DEX routing), in-app dApp browser + WalletConnect, NFTs

### Perps trade ticket (Long / Short), from the Oct 28 recording

Trust reuses ONE market list two ways, and so do we (`PerpsSearchScreen` takes `mode`):

- **Browse** (search icon, Recents, "Popular >"): tapping a market opens Market Detail.
- **Trade** (the floating Long / Short buttons on the Perps home): the identical list, but tapping a market goes straight to the ticket for that side (`PerpsTrade { venue, symbol, side }`). Market Detail's own Long / Short buttons open the same ticket.

`PerpsTradeScreen`: market header (logo with a venue badge, `40x` pill, price, day change). Holding a candle swaps it for Open / High / Low / Close, the candle's date and its signed change, and releasing restores it. Below it a compact candle chart with an Expand pill, then a draggable sheet with **three snaps**: peek (just the header row, chart goes large with Collapse, 1H 1D 1W 1M 1Y YTD AI, an interval picker and an Indicators card), half (default: amount, 5-stop slider, Leverage Cross 3x, TP/SL, Pay with, CTA, "Risk disclosure - 0.15% fee") and full (adds "Liquidation price"). The CTA reads **Fund wallet** while the venue balance is $0, then Open Long / Open Short. "Pay with" opens `PerpsPayWithScreen` (back + search, "No crypto yet" empty state, and a "Fund wallet with" NGN / USD / EUR / GBP list).

Pure logic lives in `src/services/perpsTrade.ts` (snap heights and fling settling, slider stops, size = margin x leverage, liquidation estimate, CTA state, OHLC formatting). **Not wired yet:** order signing/submission (Open Long/Short only toasts), the leverage and TP/SL pickers, the order book, fiat on-ramp purchases and Manage indicators, which all need live data / the Wallet Core signer.

### Order book (the list icon on the trade ticket), from the 12:03 recording

The ticket's list icon swaps the chart for a 19-row depth ladder and tapping it again returns to the chart (the sheet below never moves). Header `Bid | Price | Ask`; the far levels are on top and the touch is at the bottom so the bars form a funnel. Bid bars hug the centre and grow left with the price in green; ask bars grow right with the price in red. Sizes refresh about once a second. Footer: `USD v` and `Group by 1 v`, then a buy/sell ratio bar (`B 34% ===== 66% S`, always summing to 100).

Tapping either footer control opens **Order book settings**: X, centred title, Reset, "Display currency" (USD | the asset, e.g. BTC), a divider, "Group by" (1, 2, 5, 10, 100; fewer options on cheaper assets) and a solid blue **Apply**. Selected chips are the darker grey of the Filter sheet. Nothing changes until Apply, closing discards the draft, and Reset is inert while the draft is at USD / 1. Opening the book from the peek state returns the sheet to half.

Engine: `src/services/orderBook.ts` (`buildOrderBook`, `ladderRows`, `barFractions`, `buySellRatio`, formatters, grouping). **The data is synthetic and deterministic per market/tick** until the backend order-book feed is connected; the API shape matches a live feed so only the source changes.

### Search list loading layout (fixed Oct 29)

While a tab was loading, the Recents strip and tab strip (horizontal ScrollViews, which grow vertically by default) were stretched by the flex spinner box, shoving the tab pills ~175px and the provider/volume chips ~350px down the screen. Both strips are now `flexGrow: 0 / flexShrink: 0` so only the spinner takes the leftover space. This affected Browse, Long and Short alike. The Recents card now matches Trust: logo, symbol, and a grey "Perps" caption beneath (it used to read "BTC Perps" on one line).

### One market list for every entry point (Oct 29)

Tapping a coin on the Perps home now opens the same market list the search icon opens (browse mode), and the market page is one tap deeper from that list. Previously a coin jumped straight to the market page while the search icon opened the list, so the two entry points disagreed. Long/Short still open the same list in their own mode.
