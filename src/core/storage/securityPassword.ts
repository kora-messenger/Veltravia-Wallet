/**
 * Veltravia Wallet — security password, PER WALLET.
 *
 * A TEXT password, deliberately SEPARATE from the 6-digit lock-screen
 * passcode and from biometrics. Each wallet account has its own security
 * password: locking/unlocking "Main" never touches "Trading".
 *
 * It gates the AI-initiated wallet lock/unlock: the user types it on the
 * approval card FIRST, and only then does the normal biometric/passcode
 * verification run as the final step. It can be created right on the AI
 * approval card the first time, or in Settings → Wallet Lock.
 *
 * Storage mirrors passcode.ts: salted iterated SHA-256 digest in the
 * hardware-backed keychain, never the password itself.
 */
import * as Keychain from 'react-native-keychain';
import { digest } from './passcode';

const service = (walletId: string) => `com.veltravia.wallet.securitypassword.${walletId}`;

const randomSalt = () =>
  Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

/** Save a new security password for this wallet (digest only). */
export async function setSecurityPassword(walletId: string, pw: string): Promise<void> {
  const salt = randomSalt();
  await Keychain.setGenericPassword('securitypw', `${salt}:${digest(pw, salt)}`, {
    service: service(walletId),
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** True once this wallet has a security password. */
export async function hasSecurityPassword(walletId: string): Promise<boolean> {
  try {
    return (await Keychain.getGenericPassword({ service: service(walletId) })) !== false;
  } catch {
    return false;
  }
}

/** Constant-time check of an entered security password for this wallet. */
export async function verifySecurityPassword(walletId: string, pw: string): Promise<boolean> {
  let creds: Keychain.UserCredentials | false = false;
  try {
    creds = await Keychain.getGenericPassword({ service: service(walletId) });
  } catch {
    return false;
  }
  if (creds === false) return false;
  const [salt, stored] = creds.password.split(':');
  const given = digest(pw, salt);
  if (given.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
