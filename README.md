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

## Roadmap

- **Phase 1 (done):** scaffold — architecture, theme, navigation, security layer, CI
- **Phase 2:** onboarding flow (create/import wallet, seed confirm, PIN), live balances, send/receive, history
- **Phase 3:** hosted AI assistant, Buy flow, Bitcoin (UTXO wave)
- **v2:** Swap (DEX routing), Discover (DApp browser + WalletConnect), NFTs
