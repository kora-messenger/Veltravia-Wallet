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

`npx jest`: 13 suites / 68 tests, including an App smoke test mounting the full navigator, search-feed and clear-button behavior, custom token/network validation, the disclaimer wording, scan-result delivery, and the browser web/dApp chrome split. `jest.setup.js` mocks native modules (NetInfo, Keychain, Config, LinearGradient, WebView, vision-camera, image-picker); `jest.config.js` transforms React Navigation's ESM.

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
- **Two home layouts**, chosen by that balance. **Not funded:** the "Deposit to fund your first position" hero with the infinity art and a violet Deposit button. **Funded:** the hero disappears and a balance header takes its place: "Perps balance" total, unrealized P&L (green/red), Available balance row, Deposit and Withdraw buttons; tap the balance to hide it.
- **Deposit / Withdraw screen** (`PerpsDepositScreen`): moves stablecoin between the main wallet and Perps; Max button, amount validated against the source balance, over-limit message. Real settlement goes through `api.veltraviawallet.com` once the Wallet Core signing bridge ships.
- **Header and lists:** history and gear circles on the left, centered "Perps", search on the right. Sections Popular, New, Crypto, Stocks, Forex and Meme, each row a logo, symbol, leverage pill, 24h volume, a green/red sparkline, price and 24h change, with Trust's price precision. Floating green Long / red Short pills sit above the tab bar. Market data is a local dataset (`perpsMarkets.ts`) pending the backend feed.

### Settings > Perps menu

Settings > Perps opens a plain list (Trust parity): **Hyperliquid** and **Aster** (venue rows; both open the Perps tab for now, live trading waits on the Wallet Core signing bridge), **How perps work?** (the educational screen) and **Contact support**. Contact support hands `https://help.veltraviawallet.com` to the **system browser** via `Linking.openURL`; it deliberately does not use the in-app browser (`openInBrowser`). The help site itself is a separate future build, modeled on Trust's help center: "How can we help you" with FAQ search, a Get Support card with "Ask our Chatbot", Trending topics, topic cards, and a floating chat widget (Home / Help / Messages).

## Build status

Android builds via GitHub Actions (`android.yml`). Market, portfolio and Discover data are local datasets pending `api.veltraviawallet.com`; transaction signing awaits the Wallet Core native bridge.

## Roadmap

- **Phase 1 (done):** scaffold — architecture, theme, navigation, security layer, CI
- **Phase 2:** onboarding flow (create/import wallet, seed confirm, PIN), live balances, send/receive, history
- **Phase 3:** hosted AI assistant, Buy flow, Bitcoin (UTXO wave)
- **Next:** live API (prices, balances, Discover trending/search), Wallet Core signing bridge, real token logos
- **v2:** Swap (DEX routing), in-app dApp browser + WalletConnect, NFTs
