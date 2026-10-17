/**
 * Veltravia AI — cross-conversation memory (per wallet).
 *
 * Trust's assistant remembers the last conversation; ours must too. The
 * most recent finished chat per wallet is persisted (encrypted via the
 * keychain — chats can contain balances, so they never touch plain
 * storage) and offered to the next chat as recall context.
 *
 * What is stored: the chat's title, timestamp and the message TAIL
 * (capped in size). It is context for the assistant, not an archive.
 */
import * as Keychain from 'react-native-keychain';
import type { ChatMessage } from './protocol';

const SERVICE = 'com.veltravia.wallet.aimem';
const MAX_WALLETS = 20;

export interface LastChat {
  id: string;
  title: string;
  at: number;
  messages: ChatMessage[];
}

async function readMap(): Promise<Record<string, LastChat>> {
  try {
    const res = await Keychain.getGenericPassword({ service: SERVICE });
    if (res === false) return {};
    const parsed = JSON.parse(res.password);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, LastChat>): Promise<void> {
  try {
    await Keychain.setGenericPassword('aimem', JSON.stringify(map), { service: SERVICE });
  } catch {
    /* memory is best-effort; the chat must never fail over it */
  }
}

export async function saveLastChat(walletId: string, chat: LastChat): Promise<void> {
  const map = await readMap();
  const prev = map[walletId];
  // Keep the LATEST finished chat, but never overwrite a newer one with
  // an older conversation re-saved from the drawer.
  if (prev && prev.at > chat.at) return;
  map[walletId] = chat;
  const ids = Object.keys(map);
  if (ids.length > MAX_WALLETS) {
    ids.sort((a, b) => (map[a].at ?? 0) - (map[b].at ?? 0));
    delete map[ids[0]];
  }
  await writeMap(map);
}

export async function loadLastChat(walletId: string): Promise<LastChat | null> {
  const map = await readMap();
  return map[walletId] ?? null;
}
