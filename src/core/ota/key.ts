/**
 * The Ed25519 key an OTA manifest must be signed with.
 *
 * Pinned in the app on purpose: whoever holds the private half can ship
 * JavaScript that runs inside the wallet, so the trust decision cannot be
 * delegated to a server, a DNS record or a TLS certificate. Only an update
 * signed with the matching private key is ever installed.
 *
 * Generated 6 Nov 2026; the private half lives only in the OTA_SIGNING_KEY
 * secret (GitHub Actions, and this sandbox's .agents/.env).
 */
export const OTA_PUBLIC_KEY = 'hEYB1X7ocyTAYQIdKtidTxs1bFmRr3nu43ATKUILZtg=';
