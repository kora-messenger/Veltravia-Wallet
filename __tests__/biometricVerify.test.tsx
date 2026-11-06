/**
 * The biometric screen is ours (Ijezie, 6 Nov 2026: build the fingerprint
 * interface the way Trust does). The art, copy and failure states are drawn by
 * the app; the device's own dialog does the scanning on top of it. These pin
 * what the user actually sees in each state.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: require('../src/theme/tokens').themes.light }),
}));

import BiometricVerify from '../src/components/BiometricVerify';
import { FingerprintIcon, ScanFaceIcon } from '../src/components/icons';

const mount = async (props: any) => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<BiometricVerify {...props} />);
  });
  return tree;
};

/** Pressable spreads its props onto children, so match the one that acts. */
const control = (tree: any, label: string) =>
  tree.root.find(
    (n: any) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
  );

const textOf = (tree: any): string =>
  tree.root
    .findAll((n: any) => typeof n.type === 'string' && n.type === 'Text')
    .map((n: any) => [].concat(n.props.children).join(''))
    .join(' | ');

describe('BiometricVerify', () => {
  it('says what to do while the sensor is listening', async () => {
    const tree = await mount({ state: 'checking', onUsePasscode: jest.fn() });
    expect(textOf(tree)).toContain('Verify it’s you');
    expect(textOf(tree)).toContain('Touch the sensor to confirm it is you.');
    // No "try again" before a single attempt has failed.
    expect(textOf(tree)).not.toContain('Try fingerprint again');
    await act(async () => tree.unmount());
  });

  it('offers the passcode route instead of stranding the user', async () => {
    const onUsePasscode = jest.fn();
    const tree = await mount({ state: 'checking', onUsePasscode });
    const btn = control(tree, 'Use passcode instead');
    await act(async () => btn.props.onPress());
    expect(onUsePasscode).toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('names the failure and allows a retry', async () => {
    const onRetry = jest.fn();
    const tree = await mount({ state: 'failed', onUsePasscode: jest.fn(), onRetry });
    expect(textOf(tree)).toContain('Fingerprint not recognised. Try again.');
    const retry = control(tree, 'Try biometrics again');
    await act(async () => retry.props.onPress());
    expect(onRetry).toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('shows a given reason and hides retry when it would not help (lockout)', async () => {
    const tree = await mount({
      state: 'failed',
      reason: 'Too many attempts. Try again in 24s.',
      onUsePasscode: jest.fn(),
    });
    expect(textOf(tree)).toContain('Too many attempts. Try again in 24s.');
    expect(tree.root.findAll((n: any) => n.props?.accessibilityLabel === 'Try biometrics again').length).toBe(0);
    expect(control(tree, 'Use passcode instead')).toBeTruthy();
    await act(async () => tree.unmount());
  });

  it('draws the face mark on face sensors and the fingerprint mark otherwise', async () => {
    const face = await mount({ state: 'checking', biometry: 'faceId' as const, onUsePasscode: jest.fn() });
    expect(face.root.findAllByType(ScanFaceIcon).length).toBe(1);
    expect(face.root.findAllByType(FingerprintIcon).length).toBe(0);
    await act(async () => face.unmount());

    const finger = await mount({ state: 'checking', biometry: 'touchId' as const, onUsePasscode: jest.fn() });
    expect(finger.root.findAllByType(FingerprintIcon).length).toBe(1);
    expect(finger.root.findAllByType(ScanFaceIcon).length).toBe(0);
    await act(async () => finger.unmount());
  });
});
