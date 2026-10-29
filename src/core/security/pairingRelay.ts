/**
 * Veltravia Wallet — pairing relay.
 *
 * The two devices have to exchange three small things to pair: the host's
 * ephemeral public key (in the QR), the joiner's ephemeral public key, and one
 * ciphertext back. This is that channel.
 *
 * What crosses it: a session id, two public keys, an expiry, and one sealed
 * blob. What never crosses it: the recovery phrase, any private key, the group
 * key, device names, or anything the host did not deliberately seal to the
 * joiner's ephemeral key.
 *
 * Backend contract (api.veltraviawallet.com):
 *   POST   /v1/pair/session                    { sessionId, hostPub, expiresAt }
 *   POST   /v1/pair/session/:id/join           { joinerPub }
 *   GET    /v1/pair/session/:id                -> { sessionId, hostPub, joinerPub?, sealed?, cancelled? }
 *   POST   /v1/pair/session/:id/deliver        { sealed, hostPub }
 *   DELETE /v1/pair/session/:id                (cancel or consume)
 *
 * Sessions are single-use server-side too: delivering or deleting removes the
 * row, so a replayed session id returns 410. The client enforces its own 60s
 * expiry and one-time use regardless of what the server does.
 */
import { APP_CONFIG } from '../../config/env';

export interface PairingRelayState {
  joinerPub?: string;
  sealed?: string;
  cancelled?: boolean;
}

export interface PairingRelay {
  open(session: { sessionId: string; hostPub: string; expiresAt: number }): Promise<void>;
  join(sessionId: string, joinerPub: string): Promise<void>;
  poll(sessionId: string): Promise<PairingRelayState | null>;
  deliver(sessionId: string, payload: { sealed: string; hostPub: string }): Promise<void>;
  cancel(sessionId: string): Promise<void>;
}

const base = () => `${APP_CONFIG.API_BASE_URL}/v1/pair/session`;
const headers = () => ({ 'Content-Type': 'application/json', 'X-Veltravia-Env': APP_CONFIG.env });

const restRelay: PairingRelay = {
  async open(session) {
    const res = await fetch(base(), { method: 'POST', headers: headers(), body: JSON.stringify(session) });
    if (!res.ok) throw new Error('pair-open');
  },
  async join(sessionId, joinerPub) {
    const res = await fetch(`${base()}/${encodeURIComponent(sessionId)}/join`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ joinerPub }),
    });
    // 410 = session gone (expired, cancelled or already used).
    if (!res.ok) throw new Error(res.status === 410 ? 'pair-gone' : 'pair-join');
  },
  async poll(sessionId) {
    const res = await fetch(`${base()}/${encodeURIComponent(sessionId)}`, { headers: headers() });
    if (res.status === 410 || res.status === 404) return { cancelled: true };
    if (!res.ok) return null;
    const body = (await res.json()) as PairingRelayState;
    return body ?? null;
  },
  async deliver(sessionId, payload) {
    const res = await fetch(`${base()}/${encodeURIComponent(sessionId)}/deliver`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('pair-deliver');
  },
  async cancel(sessionId) {
    await fetch(`${base()}/${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: headers() }).catch(() => {});
  },
};

let current: PairingRelay = restRelay;

export const pairingRelay: PairingRelay = {
  open: (s) => current.open(s),
  join: (id, pub) => current.join(id, pub),
  poll: (id) => current.poll(id),
  deliver: (id, payload) => current.deliver(id, payload),
  cancel: (id) => current.cancel(id),
};

/** Swap the transport (tests use an in-memory relay; nothing else should). */
export function setPairingRelay(relay: PairingRelay): void {
  current = relay;
}
