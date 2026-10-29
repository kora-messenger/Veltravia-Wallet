/**
 * Veltravia Wallet — legal / policy links in ONE place.
 *
 * POLICY_URL is deliberately empty until the policy page is published. The
 * "Learn more" control that uses it is already wired and clickable: filling
 * this string is the only change needed for it to open the real page in the
 * system browser. While it is empty the tap says so instead of leading to a
 * 404 or a dead press.
 */
import { Linking } from 'react-native';

export const POLICY_URL = '';

/** True once a real policy page exists. */
export const hasPolicyUrl = (): boolean => POLICY_URL.trim().length > 0;

/**
 * Open the policy page. Returns 'opened' when handed to the OS, 'unset' when
 * no URL is configured yet, 'failed' when the browser refused it.
 */
export async function openPolicy(): Promise<'opened' | 'unset' | 'failed'> {
  if (!hasPolicyUrl()) return 'unset';
  try {
    await Linking.openURL(POLICY_URL);
    return 'opened';
  } catch {
    return 'failed';
  }
}
