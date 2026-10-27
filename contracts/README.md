# VWT — Veltravia Wallet Token

The official token contract for Veltravia Wallet (VWT).

## What it is

- ERC-20 on any EVM chain (Ethereum, BSC, Base, Polygon, Arbitrum...).
- Name `Veltravia Wallet Token`, symbol `VWT`, 18 decimals.
- Fixed supply of **1,000,000,000 VWT**, minted once to the deployer. Change the number in the contract before deploying; it can never be edited afterwards.
- No owner powers: no mint, no pause, no blacklist. Once deployed the contract is immutable — matching Veltravia's self-custodial, privacy-first ethos.

## How to deploy (no coding tools needed)

1. Open **remix.ethereum.org** in a browser.
2. Create a file `VWT.sol`, paste in `VeltraviaWalletToken.sol`.
3. Compile (Solidity 0.8.24, optimizer on).
4. Testnet first: in Deploy & Run, pick an EVM testnet (e.g. Sepolia or BSC Testnet) via "Injected Provider — MetaMask". Deploy from the wallet that should hold the supply.
5. Mainnet: repeat with the real chain. Gas needed (a simple ERC-20 deploy costs roughly $5–50 depending on the chain; BSC/Base are cheapest).

Or from this repo with Foundry/Hardhat later when the backend toolchain is set up.

## Decisions to make before mainnet

| Decision | Current default |
|---|---|
| Chain | undetermined (BSC or Base recommended: cheap fees, fast) |
| Total supply | 1,000,000,000 VWT |
| Holder of the initial supply | the deployer wallet |
| Contract verification | verify on the chain's explorer right after deploy |

## After deployment

Record the deployed contract address, then:

1. Add the address to the app's token metadata so VWT shows in Veltravia Wallet natively (icon: `src/assets/vwt-logo.png`).
2. Submit the address to CoinGecko/CoinMarketCap once it has liquidity and trades.
3. For the Perps guide step 6 and any "supported tokens" copy, VWT is already the listed ticker.

## Assets

- `../src/assets/vwt-logo.png` — 1024px coin logo (gold infinity on navy with the violet→cyan glow).
- `../src/assets/vwt-logo-small.png` — 256px in-app icon copy.
