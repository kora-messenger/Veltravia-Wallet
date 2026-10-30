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

### Home header collapse (Oct 29)

Scrolling the Home page down past the Total Balance card swaps the pill's text: the wallet name ("Veltravia Wallet") slides up and fades out while the balance amount (`$1,248.42`) slides up into the same slot and fades in. Scrolling back up reverses it. The avatar, bell and scan buttons never move. The amount follows the eye toggle (`$••••••` when hidden) and uses the card's format.

The swap is scroll-linked (`Animated.Value` fed by the ScrollView, native driver, so it runs on the UI thread) and starts at 80px, just before the card's own amount reaches the pill's line, finishing 34px later. The name fades a little faster than the amount arrives so the two never overlap. The pill reserves the width of the longer text, so it does not resize mid-swap. Logic and constants: `src/services/headerCollapse.ts`.

Also fixed: the header chips are only 10% opaque, so scrolled content (e.g. "Back up your wallet") showed through the wallet name. A page-coloured strip now fades in behind the header between 4px and 28px of scroll, fully opaque before the swap begins.

### QR scanner matched to Trust pixel-for-pixel (Oct 29)

Measured off Trust's scanner screenshot (461px wide = 411dp, 1dp = 1.1216px) and applied as constants in `ScanQrScreen.tsx`:

| element | Trust (measured) | value used |
|---|---|---|
| header button | 52-53px = 47dp, solid #202020 | `BTN = 47` |
| header side margin | 20px = 18dp | `EDGE = 18` |
| gallery/torch gap | 10px = 9dp | `GAP = 9` |
| button centre from top | 68px = 61dp | `insets.top + 12` |
| bracket square | 311px = 277dp | `FRAME = 277` |
| bracket arm | 62px = 55dp | `ARM = 55` |
| bracket line | 11px = 10dp | `THICK = 10` |
| corner radius | ~20px = 18dp | `RADIUS = 18` |
| X icon | 15.2dp | 15 |
| gallery icon | 20.5dp | 21 |
| torch icon | 21.4dp tall | 21 |
| title | 15.2dp cap height, centred at x=230 (screen centre) | 17dp, absolutely centred |

Also: the page is now pure black with a black scrim (it was a navy tint with a lighter grey mask), the header buttons are solid #202020 instead of translucent grey, and the title is centred on the screen rather than in the space left over between the buttons. The torch icon turns amber while lit.

### Scanner chases the code before reading it (Oct 29)

A detected QR no longer pops the screen instantly. The brackets (and the clear window in the dim mask) fly from the centre onto the code's own rectangle, square up around it with 10dp of padding, hold for 130ms, and only then report the value.

- Geometry: `src/services/scanFrame.ts` (`codeTargetRect`, `morphDuration`). Uses the code's corners when the camera supplies them, so a tilted code is framed by its real extent rather than its larger axis-aligned box; never shrinks below 120dp (the four arms would collapse) and never leaves the screen.
- Timing: 140-320ms, scaled by how far the box has to travel, cubic ease-out.
- Lock-on: the first valid code claims the scan, so a second code in view cannot hijack the result mid-flight. A code with no reported position is still read immediately.
- The brackets keep Trust's measurements (55dp arms, 10dp lines, 18dp radius); only the box they sit in moves and resizes.

### Scanner capture sound (Oct 29)

A code now rings when it is taken: a short two-note bell (E6 then B6, inharmonic partials, exponential decay) plus a 35ms haptic tick. Camera captures get bell + tick; codes read from a picked photo get the bell only, since nothing was "caught".

The bell is a generated 45 KB WAV at `android/app/src/main/res/raw/scan_captured.wav`, played through `SoundPool` (low latency, never blocks the UI) by `ScanFeedbackModule.kt`. No audio dependency and no licensed sample. `src/core/scanFeedback.ts` is the JS side; it reads the native module at call time, falls back to a bare vibration when the module is absent, and never throws, so feedback can never break a scan.

### What Trust's scanner actually does (from the APK, Oct 29)

- No capture sound ships with Trust at all. The only audio assets are four support-chat clips (`intercom_*`). Its capture feedback is haptic: a `vibrateByPattern` native call.
- Screen analytics show the flow: `QR_SCAN_VIEWED` on open, `QR_SCANNED` / `SCANNER_RESULT` on a read, plus `pay_qrcodescanner_clicked`, `pay_qrauth_viewed`, `pay_qrauth_completed` and `pay_invalid_qr_bottomsheet_viewed` — so the scanner is also reachable from the Pay flow, and an unrecognised code opens a bottom sheet rather than a toast.
- Reads go through a `UniversalQRUriParser` (it understands chain-prefixed URIs like `eip155:`), so it decides what a code *means*, not just that it decoded.
- Idle text is localised ("Escanea el QR", "Scannez", "Scansiona"), and the header keeps the same three controls we now match: close, gallery, torch.

Still missing on our side: the invalid-QR bottom sheet (we show a toast) and that universal URI parsing.

### Scanned codes are parsed, and bad ones explain themselves (Oct 29)

Two of Trust's scanner behaviours we were missing.

**Universal parsing** (`src/services/qrParse.ts`): a scan is classified, not just decoded.

| what was scanned | result |
|---|---|
| `0x…` (40 hex) | wallet address |
| `ethereum:0x…@56?value=…` | payment, chain + amount |
| `ethereum:<contract>@1/transfer?address=<to>&uint256=…` | token transfer, contract + amount |
| `eip155:1/erc20:0x…` | asset (CAIP-19) |
| `wc:…@2?relay-protocol=…` | WalletConnect pairing |
| `https://…` | link (host shown) |
| anything else | not a wallet code |

A screen waiting for a scan now receives the **usable value** (the address inside a payment URI, the URL) rather than the raw envelope. Chain names resolve for Ethereum, BNB Chain, Polygon, Base and Arbitrum.

**Invalid/standalone codes** get Trust's bottom sheet instead of a toast (`ScanResultSheet.tsx`): the code type, the value, the chain, and one action — Copy address, Send, Open link or Connect — plus Scan again. So a WiFi QR shows "Unrecognised code · Not a wallet code" instead of silently vanishing, and the reason stays on screen until dismissed.

Not wired yet: WalletConnect pairing says so plainly rather than pretending, and a payment URI shows its amount but does not pre-fill a send.

### Every coin opens the same Perps market page (Oct 29)

Tapping a coin used to depend on where you tapped and in which mode: on the Perps home it opened the market *list*, and a list opened from a Long or Short pill sent the tap straight into the trade ticket. That split is gone.

- A coin tap anywhere — Perps home rows and watchlist, the search list in any mode, the Recents cards, and Related markets on another market page — now opens `PerpsMarket` for that coin.
- `PerpsSearch` no longer reads `mode` for routing; it is a pure market picker, reached only from the search icon.
- The Perps home's floating Long/Short pills were removed: they existed only to pre-pick a side for a list tap that no longer behaves differently. The side is chosen on the market page, where Long/Short open the ticket for that market (unchanged).

### Home header is transparent again (Oct 29)

The opaque page-coloured strip behind the header is gone. The header floats over the content exactly as it does before you scroll: the wallet pill and the two circular buttons keep their own translucent chip colour (`rgba(60,64,90,0.10)` in light mode), and nothing paints a full-width band. The name-to-balance swap still happens at the same 80px threshold.

### First wallet lock: create the password, don't ask for one that isn't there (Oct 29)

The AI lock card read the keychain flag backwards. `noSecurityPw` was filled with `hasSecurityPassword()`, then passed straight in as `noPassword`, so on a wallet with no password the card showed the *verify* form: whatever the user typed answered "Incorrect security password." That is fixed — the flag is now `hasSecurityPw` (`null` while the keychain is being read) and the card takes `noPassword={hasSecurityPw === false}`.

The first-use card now matches how the Settings screen teaches the same secret:

- **Security password** and **Re-enter password**, each with its own hide/unhide eye (`EyeIcon` / new `EyeOffIcon`), and a red border on the confirm field when the two differ.
- **Use passcode** in the card's top-right corner, in both the create and the verify state. It opens the same 6-dot, auto-verify `PasscodeConfirmSheet` the Settings → Wallet Lock screen uses, so the 6-digit passcode can confirm the lock instead of the text password when the user prefers that. That is VELTRAVIA'S OWN passcode (`com.veltravia.wallet.passcode`, digest only, set at onboarding) — never the device PIN/pattern, which only the OS itself ever asks for. The sheet's copy is now passed per job, so a lock says "Confirm wallet lock" instead of "Confirm transfer".

#### Questions are answered, not executed (2026-10-29)

Ijezie asked the AI "Do you have the ability to lock my wallet to avoid others to send coin" and got a **Lock your wallet** approval card. A lock freezes someone's funds, so it may only follow a request.

- `src/ai/intent.ts` classifies a message as `lock`, `unlock`, `ask-lock`, `ask-unlock`, `decline` or nothing. A question mark or an interrogative opener (`do/can/how/what/…`) makes it a question; "don't lock it / never lock / no lock" makes it a refusal.
- The offline brain answers questions with `lockCapabilityAnswer`. The answer is honest about the limit: the lock freezes sending, swapping and AI transfers **in this app on this device**, it is **not on-chain**, and anyone with the recovery phrase or private key can still move the funds from another wallet app — only moving funds to a fresh wallet protects against that. It ends by offering ("say \"lock my wallet\"") instead of acting, and offers the unlock wording instead when the wallet is already locked.
- A refusal gets "Understood — I won't lock it" and nothing else. Previously "don't lock my wallet" matched the lock regex and would have locked it.
- **Two independent gates** for the hosted model: the prompt now forbids a directive for a question or a refusal, and `handleDirective` re-checks `lockIntent(userText)` in code and swaps the card for the honest answer. A model can ignore instructions; the code cannot be talked out of it.
- Tests: `__tests__/lockIntent.test.ts` (8) and `__tests__/lockQuestionAnswered.test.ts` (3, driving the real offline brain with the exact reported message).

#### Where pairing lives in the UI (2026-10-29)

- **Old device (has the wallet):** Manage account → **Pair a new device** row, which opens `PairingCodeSheet` (live QR, 5-minute countdown, "New code"). The same sheet is reachable from Settings → Security → Paired devices.
- **New device (no wallet):** "Select recovery method" now has a **Pair device** row under View-only wallet. It registers a scan target and opens the QR scanner; on a read it calls `joinGroup`, then says "Device paired. Now restore with your secret phrase."
- **Pairing from the scanner with nothing waiting** (home scan button) is handled too: the result sheet's primary action is "Pair this device".

**The code is deliberately lean:** `veltravia-pair://join?g=<group>&k=<key>&e=<expiry>`, no device names. Two reasons: a QR has a hard size ceiling (the first version overflowed and threw "QR payload too long" — `QrCode` now grows to the smallest version that fits, up to v10, instead of dying), and names already sync inside the sealed blob via `adoptRemoteDevices`. Tests in `__tests__/pairingFlow.test.tsx` and `walletGroup.test.ts` pin both properties, including that the URI never contains the phrase.

#### Showing a pairing code requires authentication (2026-10-29)

A pairing code is an invitation into the device group, so displaying one is a security action, not a display action. `src/core/security/pairingAuth.ts` enforces that: the sheet opens **locked** and mints nothing until the owner proves presence — the OS biometric prompt (fingerprint/face via `promptBiometrics`) or this wallet's own 6-digit passcode (`PasscodeConfirmSheet`). No proof exists on the device, no code is shown at all, and the button says so instead of failing silently.

No authorisation is cached. Each code is minted immediately after the proof and the proof is discarded, so **"New code" asks again**; a cancelled or failed prompt never falls through to "show it anyway", and merely opening the sheet triggers nothing.

#### Pairing never loosens the original device (2026-10-29)

`src/core/security/pairingPolicy.ts` snapshots what protects the device before a hand-off (per-wallet lock flags, app lock, the registry's "locked elsewhere" answer) and restores anything that moved, returning a drift report. `approveJoiner` runs it around every delivery, so adding a device can only ever add protection: a locked wallet stays locked, and a "locked elsewhere" answer is never replaced by "unlocked" because a new device joined.

#### Pairing is a handshake, and the old format still parses (2026-10-29)

Two things are true at once, and they were easy to confuse:

1. **Nothing about the wallet was removed.** The recovery phrase, the private-key import path, the seed in secure storage, and the wallet-group key all still exist and still work. `buildPairingPayload`, the legacy parser, `joinGroup`, `seal`/`open`, key rotation and envelopes are all intact.
2. **The pairing QR stopped printing the wallet key on screen.** What the app *shows* is now `veltravia-pair://2?s=<sessionId>&p=<ephemeral public key>&e=<expiry>`: 60 seconds, single use, unique per code, cancellable by either side, and nothing secret inside it.

How they reconcile: `LEGACY_PAIRING_ACCEPTED = false` in `walletGroup.ts`. The old key-bearing format is still parsed (`parseLegacyPairingPayload`) and still produced by `buildPairingPayload` for compatibility, but `parsePairingPayload` returns `legacy` instead of trusting it, so a leaked screenshot cannot be replayed into a device group. Flip the constant to accept old codes again; the format was never deleted.

#### Pairing handshake (files)

- `src/core/security/pairingSession.ts` — session lifecycle (60s TTL, one per device at a time, one-time use via a consumed-id set), 6-digit safety number from both ephemeral public keys, sealing the group material to the joiner's ephemeral key, cancel/expire handling.
- `src/core/security/pairingRelay.ts` — the four/five-route relay contract on `api.veltraviawallet.com` (`POST /v1/pair/session`, `POST .../:id/join`, `GET .../:id`, `POST .../:id/deliver`, `DELETE .../:id`). Only public keys, a session id and one ciphertext ever cross it. Transport is injectable (`setPairingRelay`) so tests run offline.
- `src/core/security/pairDevice.ts` — the joining side in one call (`pairWithCode`) plus human-readable failure reasons.
- `src/components/PairingCodeSheet.tsx` — shows the live code with a `0:59` countdown, switches to the six digits for confirmation, and cancels the session on close.
- Tests: `__tests__/pairingSession.test.ts` (11) covering no-secrets-in-code, expiry, one-time use, cancel, relay leakage, MITM mismatch; `__tests__/pairingFlow.test.tsx` and `__tests__/walletGroup.test.ts` updated for the guarded legacy path.

#### An unlinked device wipes itself and returns to Welcome (2026-10-29)

Removing a device used to leave the removed phone working with its own local lock. That is now wrong: on removal the phone **deletes the wallet and goes back to the welcome screen**, like a fresh install.

- `src/core/security/deviceRemoval.ts` — `wipeRemovedDevice()` clears the phrase, accounts list, lock flags, cached registry blob, wallet group, device id/key and per-account security passwords, then resets in-memory caches (caches first: their setters would re-create the entries being deleted).
- `removalEvents.ts` — a dependency-free event so the registry can raise "this device was removed" and the app root can act, without the two importing each other.
- `lockRegistry` raises it when it finds state it cannot decrypt; `App.tsx` registers the handler, calls `handleDeviceRemoved()`, then `resetToWelcome()` (full navigation reset).
- `WelcomeScreen` shows a one-shot notice: "This device was unlinked", read via `takeRemovalNotice()`.
- Tests: `__tests__/deviceRemoval.test.ts` (wipe contents, single event, idempotent) and `__tests__/deviceRevocation.test.ts` (rotation and envelopes).

**Honest limits, unchanged:** this is a cooperative wipe for an honest install. No wallet can force a modified build or an offline phone to forget a phrase it already has. What cannot be bypassed is the key rotation: the removed device holds no envelope for the next epoch, so it cannot read future lock state or re-derive it. Non-custodial is intact throughout — the phrase never leaves the device, and the server stores only ciphertext.

#### Removal is now a real revocation (2026-10-29)

The phrase still gives the wallet its identity, but it no longer grants the lock key. The key is per-device state:

- `group.key` is whatever this device last held, at `group.epoch`. A recovery phrase only bootstraps epoch 0.
- Each device has an X25519 keypair (`deviceKeyPair()`, secret in the keystore, public half in the device list).
- **Remove** rotates: new random key, `epoch + 1`, and the new key is wrapped separately for every *remaining* device (`nacl.box` with that device's public key). This device keeps the new key directly.
- The announcement travels sealed with the **old** key (`rotate` field), so peers can read it and find their envelope. A removed device can read the announcement too: it just has no envelope, and cannot forge one, because wrapping needs the author's secret key.
- A device that fetches state it cannot open is marked removed (`markRemoved`), shows the notice on Paired devices, and stops publishing. It keeps working with its own local lock.
- Tests: `__tests__/deviceRevocation.test.ts` proves the removed device finds no envelope, cannot read the next blob, and that a remaining device adopts the rotation and reads it.

**Trade-off, stated plainly:** because epoch 0 derives from the phrase, a fresh restore after any removal lands on the old key, so that phone needs pairing to rejoin. That is the price of removal actually sticking. It also means the removed phone still holds the funds (it has the phrase); this stops lock-state access, not spending.

Backend needs `rotate` on `PUT /v1/wallet-lock/state` and to return it on `GET` (otherwise peers never see a rotation).

#### Wallet groups: the seed is the identity, pairing is the shortcut (2026-10-29)

"Can't the unlock on the old device still work?" — yes, and that is now the design. Same as Trust Wallet, the wallet's identity is the recovery phrase:

- `deriveSeedGroup(seed)` → `groupId = digest(seed, 'veltravia-group-id-v1')[:32]`, `key = digest(seed, 'veltravia-group-key-v1')` (3000-round salted SHA-256). A wallet recovered on a second device lands on the same group with no ceremony, so **lock on phone A blocks phone B, and unlocking on either device clears both** (`__tests__/seedGroupSync.test.ts`, 5 tests).
- **Pairing is also there**, for adding a device without retyping the phrase. *(Superseded 2026-10-29: the `veltravia-pair://join?g=…&k=…` format is refused outright now. See "A paired device is a whole wallet" at the end of this file for the current protocol.)*
- The pairing code carries the group key **and the device list**, so a newly paired device immediately shows "this wallet is on these devices".

**Privacy of device names — the specific question:** the backend never sees a device name. The only network body is `{ groupId, blob }` where `blob = seal(groupKey, { deviceId, locked, at, devices })`. Names live inside that sealed box, so they sync between devices while the server stores ciphertext. Names are also never harvested from the OS: the default is the literal string "This device". Tests assert it: `Object.keys(body) === ['blob','groupId']` and the raw body does not match `/Pixel|Tablet/`.

Honest limit, stated in the app and here: because the group key derives from the phrase, anyone who has the phrase can read the group's state and appears in the list — though they can already spend the funds. Removing a device therefore only tidies the list; it cannot revoke a phone that still holds the phrase. Key rotation applies only to a paired (no-seed) group.

#### Is the lock custodial? No — and it now costs nothing in privacy (2026-10-29)

Audit answer, for the record:
- **Custody is untouched.** Keys never leave the device; the backend never signs, never moves funds, and has no path that can lift a lock. Unlocking requires the local security password plus biometrics/passcode, verified on the device (`setWalletLocked` is called only from `AiChatScreen` and `WalletLockSheet` after local authentication). A hostile or compromised server can at most hide the *cross-device* signal; it can never unlock the local lock or spend.
- **Registry is now opt-in and OFF by default** (`APP_CONFIG.LOCK_REGISTRY_ENABLED`, `Config.LOCK_REGISTRY_ENABLED === 'true'`). While off, `publishLockState` and `refreshRegistryLock` return immediately: zero requests, zero identifiers, the lock is purely local. That is the shipping default until the endpoints exist.
- **No device fingerprint.** The payload used to carry the hardware model ("Pixel 7") — a real identifier that narrows a user down. Removed: the label is omitted unless a user-set label exists, and the other device simply says "the older device".
- **What the registry would disclose if switched on:** a stable pseudonym `digest(seed, "veltravia-lock-v1")` (3000-round salted SHA-256 — not reversible, and 128-bit seeds are not brute-forceable), a random 12-byte device id and a timestamp. Not the seed, not an address, not a balance. The honest caveat: that pseudonym is a *permanent cross-device marker* for one wallet, the one class of identifier an unlinkability-first wallet should be shy about. Hence opt-in, and the recommended path before enabling it in production is pairing-by-QR (device A shows a code, device B scans it) so no seed-derived value ever reaches the server.
- Tests: `__tests__/lockRegistryPrivacy.test.ts` (2) pins the off state — no fetch, no block, nothing to correlate.

#### Cross-device lock enforcement (2026-10-29)

A locked wallet is never "active": value movement is refused on every surface, and a wallet recovered on a new device knows it is locked on the older one.

- **One guard, two truths** — `src/core/security/valueGuard.ts` is the only thing money paths ask. `movementBlock(walletId)` returns `locked-here`, `locked-elsewhere` or null; `movementBlockTitle/Message` own the wording so it cannot drift between screens.
- **Wired surfaces** — the AI transfer pipeline (`prepareTransfer`, which now also covers the current-device case), the Swap tab, the Home Send/Swap tiles (a tap while locked opens the reason instead of doing nothing; Receive and Buy stay available) and the Perps trade CTA. Any future send/swap execution calls the same guard.
- **Cross-device registry** — `src/core/security/lockRegistry.ts` publishes `{key, locked, deviceId, deviceName, at}` to `PUT /v1/wallet-lock/state` and reads `GET /v1/wallet-lock/state?key=` on our own API host. The `key` is `digest(seed, 'veltravia-lock-v1')`, derived ONLY from the recovery phrase, so the same wallet on another device lands on the same record. No address, balance or identity ever leaves the device.
- **Offline rules, deliberately** — a failed publish is queued and retried before the next read; an unknown state never blocks by itself; a cached "locked elsewhere" answer KEEPS blocking until a newer answer refutes it (a flight-mode toggle must not unlock money). The local flag remains the primary gate; the registry only adds the recovery case.
- **Copy** — on the recovered device the AI and the UI say "Account locked. Unlock your account on the older device where you locked it (device name)." On the device that locked it: "Your wallet is locked. Unlock it to send, swap or trade." The elsewhere variant never offers an unlock button, because this device cannot lift it.
- **Sync points** — app launch (`App.tsx`), the Wallets list, the AI chat, and right after a wallet is created or recovered (`NameWalletScreen`); every lock/unlock publishes immediately from both the Settings sheet and the AI chat.
- **Warning** — `src/components/LockWarning.tsx` on Settings → Wallet Lock and the AI first-use card: choose a password or passcode you will not forget, a forgotten one can cost access to the wallet, and Veltravia Wallet cannot recover it and is not responsible for any loss. **Learn more** is a real clickable link (`accessibilityRole="link"`, underlined) wired to `openPolicy()` in `src/config/legal.ts`; `POLICY_URL` is intentionally empty until the page exists, and while it is empty the tap says the policy page is coming soon rather than dying silently. Filling that one string is the only change needed to make it open the real page. New: `src/components/LockedNotice.tsx`.
- Tests: `__tests__/walletLockCrossDevice.test.tsx` (9) — key derivation, publish payload privacy, offline queueing, elsewhere-block copy, AI transfer refusal, own-lock handling, cache survival and clearing, and the warning's Learn more.
- While the keychain read is in flight the card shows "Checking this wallet…" instead of guessing which form to show.
- Approve / Set password & Approve now carry accessibility labels.

### A paired device is a whole wallet, not a lock subscriber (Oct 29)

Pairing used to hand over only the group key, so a "paired" phone could never receive, send or recover: it was a spectator. It now provisions the wallet itself.

**What crosses the wire, in order**

1. Host shows `veltravia-pair://2?s=…&p=…&e=…` — a session id, an **ephemeral** public key and a 60-second expiry. No phrase, no key, no device name.
2. New device scans it, generates its **own** ephemeral X25519 pair, and publishes only the public half (`beginPairingJoin`).
3. Both sides derive the same six digits from the two public keys (`safetyNumber`). The host displays them; the new device asks the user to **type** them. Typing is the check: a relay that swapped a key produces different digits on each phone, so the human sees a mismatch and cancels.
4. `verifyPairingDigits` compares in constant time, allows **five** attempts, then cancels the relay row and burns the code. `completePairingJoin` refuses to even poll for a session whose digits were never proven, so the gate cannot be skipped by calling the protocol directly.
5. Host seals `{kind: veltravia-pair/2, groupId, key, epoch, seed, accounts}` to that ephemeral key (`nacl.box`) and consumes the session.
6. New device opens it, writes the phrase through `storeSeed` — the same keystore path every other import uses — then adopts the group and lands on the wallets list.

**Why this is still non-custodial.** The backend relays ciphertext it cannot open: the box is sealed to a key generated on the new phone seconds earlier, never persisted, discarded when the flow ends. There is no endpoint that returns a phrase, no server-side unwrap, and no path by which our infrastructure can sign. Same code, same derivation, same keystore as a manual restore — pairing is a faster phrase entry, not a second custody model.

**Same wallet, proven, not assumed.** The host sends the addresses it derives; the new device derives from the delivered phrase and compares (`checkIdentity`). They must match on every chain the host listed. A mismatch wipes what was just stored and fails with "this phone derived different addresses" rather than presenting a lookalike wallet. When the native derivation bridge is missing from a build, the result says `identity: 'unavailable'` — reported, never faked.

**Revocation, stated plainly.** Removing a device rotates the group key, so that phone stops reading lock state and must pair again. It does **not** delete the recovery phrase already written to that phone's keystore, and it cannot: the phrase works in any wallet app. The confirmation dialog and the Paired devices footer both say so, and point at the only remedy that actually works — move the wallet to a new phrase and abandon the old one.

**Honest gap: nothing signs yet.** `WalletCoreNative` in `src/core/wallet/walletManager.ts` exposes mnemonic import, phrase export and address derivation only — there is no `sign` call, and `src/ai/signer.ts` returns `unavailable` by design. So "sign independently on the paired device" is not something this change can deliver, because no device can sign today. What pairing now guarantees is the *provisioning* half: both phones hold the same phrase, derive the same addresses, and will sign identically the moment the WalletCore signing bridge and the broadcast relay land. No send, swap or dApp transaction is claimed as working anywhere in the app until then.

**Tests** — `__tests__/pairingFullAccess.test.ts` (8): phrase released only after the digits match; the phrase never appears in anything the relay carries (the mock records every byte); a wrong code cannot open the box (`unverified`); five wrong guesses kill the session and the correct code no longer rescues it; a five-digit entry costs no attempt; the phrase reaches the keystore through `storeSeed`; a mismatched code never reaches storage; a derived-address disagreement wipes and fails. Full suite: 404 passing, `tsc --noEmit` clean.

**Still needed on the backend:** `POST/GET /v1/pairing-relay/*` (open, join, poll, deliver, cancel) and `/v1/wallet-lock/state`. Until they exist, pairing works only against the in-memory relay used by tests, and cross-device lock sync stays off (`LOCK_REGISTRY_ENABLED = false`).

### Lock state travels with the wallet (Oct 29)

A paired phone used to arrive unlocked with no lock password, which meant adding a device quietly loosened the wallet on the new handset. Fixed: the pairing box now carries the lock flags and the security-password **verifier**, so the new phone starts exactly as protected as the old one and the password the user already knows opens it there.

- **What is transferred** — `walletId -> locked` flags, plus `walletId -> "salt:digest"` verifiers (`src/core/security/lockTransfer.ts`). The password itself is never transferred: the old device does not have it either, only its digest.
- **The honest trade-off** — a verifier can be brute-forced offline by whoever holds it. That is accepted because the same sealed envelope already carries the recovery phrase, which is strictly more powerful, and the alternative (an unlocked new device) is worse. The digest is salted and iterated (`passcode.digest`), and it only ever exists inside a box sealed to the new phone's one-time key.
- **Conservative import** — a lock is only ever added, never removed, and a verifier is adopted only when this device has no password for that wallet. A local credential is never replaced by one that arrived from another device.
- **Biometrics do not travel** — they belong to the new handset's hardware and enrolment. The second step stays device-local: the same password, then this phone's own fingerprint/face/passcode.
- **Unlocking is symmetric afterwards** — once paired, either device can lock or unlock without asking the other. The lock is a property of the wallet, not of a handset.
- **Surfaces** — the success screen says the wallet came over locked when it did; the Paired devices footer states that lock state and password travel while biometrics do not.
- **Tests** — `__tests__/pairingLockInheritance.test.ts` (6): locked wallet arrives locked and the same password opens it (wrong password rejected); the password never appears in relay traffic and the verifier is a salt:digest; an unlocked wallet does not invent a lock; a local password is never overwritten; exporting does not change the host; the inherited lock actually trips `movementBlock` and unlocking locally clears it. Full suite: 410 passing.


**Restore screen, second pass (user spec, Oct 30).** Back chevron left, nothing in the top middle, an
animated scanner icon right, "Restore wallet" under the back arrow. One full-height box whose centred
placeholder is "Enter secret phrase"; words start there and wrap onto new centred lines. Paste (app colour)
sits bottom-right until the box has text, then Clear and Hide pills take its place. Hide masks the words and
becomes Show. Continue stays disabled until the phrase passes BIP-39 wordlist plus checksum.

**Restore screen rebuilt to the current Trust layout (Oct 30 screenshot).** "Multi-coin wallet" with a
wallet-name field (clear button, prefilled with the next free name), a tall secret-phrase box with Paste,
the "Typically 12 (sometimes 18, 24) words separated by single spaces" helper, Restore wallet, and a
"What is a secret phrase?" explainer. A scanned QR fills the box for review instead of restoring blindly.
The BIP-39 wordlist and checksum are still enforced. Restore goes straight to the home tabs with the new
wallet name.
### The recovery phrase is real now, on Trust's flow (Oct 30)

**Secret phrase screen, matched to the current Trust build (video, Oct 30).** The screen opens with
the words *concealed*: a blurred stand-in inside the card, a "12 words" label and a Show pill. Show opens
the "Keep your secret phrase safe" popup (X closes it and reveals nothing); only **I understand** puts the
real words in the card. "I've already backed this up" sits in a card pinned above the button, and **Done**
stays dim until it is ticked. Tapping Done shows a small spinner at the button's right corner, then returns
to Manage account; a second tap during the spinner does nothing. The phrase lives in component state only.

**Lock sealing hardened (not yet used by the registry).** The lock box is now XSalsa20-Poly1305 with the
group id, key id and purpose bound inside the authenticated data, so another wallet's blob cannot be
substituted. Nonces come from a CSPRNG and generation fails closed without one. A domain-separated HKDF
lock key (`v2`) exists next to the legacy `v1`, which is kept byte-identical so existing wallets are not
orphaned. The shared registry client is unchanged and `LOCK_REGISTRY_ENABLED` stays false.

Until today the app had no phrase at all: "Create wallet" went straight to the home
screen and Import accepted any twelve words you typed and stored nothing.

**Creation creates the wallet, silently.** Create → passcode → Home, exactly like Trust.
The twelve words are generated and written to the keystore as the passcode flow
finishes; nothing is revealed during onboarding. If generation fails (no CSPRNG, no
keystore) the app stays on the welcome screen instead of pretending a wallet exists.

**Reveal follows Trust's path:** Wallets → wallet 3-dot → Manage → Manage account →
Show secret phrase → the existing acknowledgement sheet (illustration, two ticks) →
passcode → `SecretPhraseScreen`, one box with the twelve words in order, Hide and Copy.
Leaving the screen drops the words from memory; Copy marks the clipboard entry
sensitive so it stays out of the paste history. The "Back up" row opens the same gate.

- `src/core/wallet/bip39.ts` generates and validates BIP-39 phrases with the official
  2048-word English list vendored in `bip39Wordlist.ts` (public domain, never edit or
  re-sort it: the checksum indexes into it). Entropy comes from `secureRandomBytes`,
  which throws when the platform has no CSPRNG rather than using `Math.random`.
- `__tests__/bip39.test.ts` checks it against the official BIP-39 vectors and proves a
  single swapped word or an off-list word is rejected.
- `__tests__/secretPhrase.test.tsx` covers creation storing a valid phrase, a bad
  checksum storing nothing, normalisation on import, and the reveal screen (box, hide,
  sensitive copy, honest "no phrase on this device" state).

Honest gap, unchanged: a phrase made today has no addresses yet. Address derivation
needs secp256k1/BIP-32 and this build ships neither, so `deriveAccounts()` still relies
on the WalletCore bridge that is not bundled. The phrase is real and restorable; the
addresses that hang off it land with the WalletCore integration.
