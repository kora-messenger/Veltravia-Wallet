/**
 * Veltravia Wallet — security password.
 *
 * A TEXT password, deliberately SEPARATE from the 6-digit lock-screen
 * passcode and from biometrics. It gates the AI-initiated wallet lock/unlock:
 * the user types it on the approval card FIRST, and only then does the
 * normal biometric/passcode verification run as the final step.
 *
 * Storage mirrors passcode.ts: salted iterated SHA-256 digest in the
 * hardware-backed keychain, never the password itself.
 */
import * as Keychain from 'react-native-keychain';
import { digest } from './passcode';

const SERVICE = 'com.veltravia.wallet.securitypassword';

/** Save a new security password (salted + iterated digest only). */
export async function setSecurityPassword(pw: string): Promise<void> {
  const salt = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  await Keychain.setGenericPassword('securitypw', `${salt}:${digest(pw, salt)}`, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** True once a security password exists on this device. */
export async function hasSecurityPassword(): Promise<boolean> {
  return (await Keychain.getGenericPassword({ service: SERVICE })) !== false;
}

/** Constant-time check of an entered security password. */
export async function verifySecurityPassword(pw: string): Promise<boolean> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  if (creds === false) return false;
  const [salt, stored] = creds.password.split(':');
  const given = digest(pw, salt);
  if (given.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
