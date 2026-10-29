/**
 * Veltravia Wallet — who is allowed to put a pairing code on the screen.
 *
 * A pairing code is an invitation into this device group: whoever scans it can
 * ask to join, and the owner's confirmation completes it. So the act of
 * SHOWING one is a security action, not a display action. Having the app open
 * is not consent — a phone handed over unlocked, a phone left on a table, or a
 * phone in a bag must not be able to mint codes.
 *
 * Therefore every code requires a fresh, explicit proof of presence:
 *
 *   1. the OS biometric prompt (fingerprint / face), when the device has it;
 *   2. otherwise this wallet's own 6-digit passcode, verified by digest;
 *   3. otherwise the flow refuses. There is no "continue anyway".
 *
 * No authorisation is cached anywhere. Each code is minted immediately after
 * the proof and the proof is discarded, so a re-mint after expiry asks again.
 */
import * as Keychain from 'react-native-keychain';
import { isBiometricsSupported, isBiometricUnlockEnabled, promptBiometrics } from './biometrics';
import { hasPasscode } from '../storage/passcode';

export type PairingAuthMethod = 'biometric' | 'passcode';

export interface PairingAuthOptions {
  biometric: boolean;
  passcode: boolean;
}

/** What this device can actually ask for right now. */
export async function pairingAuthOptions(): Promise<PairingAuthOptions> {
  const [supported, passcode] = await Promise.all([isBiometricsSupported(), hasPasscode()]);
  // A device with a sensor but no biometric unlock enabled still gets the OS
  // prompt: it is the stronger factor and the user asked for pairing.
  let biometric = false;
  if (supported) {
    biometric = true;
    try {
      // Do not depend on the preference: the prompt itself is the proof.
      await isBiometricUnlockEnabled();
    } catch {
      /* preference is advisory only */
    }
  }
  return { biometric, passcode };
}

/** True when at least one acceptable proof of presence exists on this device. */
export async function pairingAuthAvailable(): Promise<boolean> {
  const o = await pairingAuthOptions();
  return o.biometric || o.passcode;
}

export type PairingAuthOutcome =
  | { ok: true; method: PairingAuthMethod }
  | {
      ok: false;
      /** 'cancelled' = the user backed out; 'failed' = wrong/refused; 'none' = nothing to ask for. */
      reason: 'cancelled' | 'failed' | 'none';
      /** True when the keypad can still be offered as the fallback. */
      passcodeAvailable: boolean;
    };

/**
 * Runs the biometric proof, if the device has one.
 *
 * The caller shows the passcode keypad when this comes back not-ok and
 * `passcodeAvailable` is true — deliberately explicit, so a failed fingerprint
 * never silently turns into "no check at all".
 */
export async function authenticateForPairing(): Promise<PairingAuthOutcome> {
  const options = await pairingAuthOptions();

  if (options.biometric) {
    let passed = false;
    try {
      passed = await promptBiometrics(
        'Show pairing code',
        'Confirm it is you before a code that can add a device is shown.',
      );
    } catch {
      passed = false;
    }
    if (passed) return { ok: true, method: 'biometric' };
    return { ok: false, reason: 'cancelled', passcodeAvailable: options.passcode };
  }

  if (options.passcode) {
    // Nothing biometric to try: the keypad is the proof, and the caller owns
    // the keypad UI (PasscodeConfirmSheet) so the copy stays consistent.
    return { ok: false, reason: 'cancelled', passcodeAvailable: true };
  }

  return { ok: false, reason: 'none', passcodeAvailable: false };
}

/**
 * Confirm that showing a code is being done by a person, not by an unattended
 * screen. Cheap, and it documents the intent at every call site that mints.
 */
export async function assertOwnerPresent(): Promise<boolean> {
  try {
    const res = await Keychain.getGenericPassword({ service: 'com.veltravia.wallet.seed' });
    // The seed entry is only readable after the OS has unlocked the device for
    // this app; absence means no wallet, which is not a pairing situation.
    return res !== false;
  } catch {
    return false;
  }
}
