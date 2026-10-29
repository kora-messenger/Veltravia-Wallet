/**
 * Veltravia AI — the wallet-lock card.
 *
 * The bug this locks down: the "no password yet" flag was inverted, so the
 * FIRST ever lock asked for a password that had never been created and always
 * answered "Incorrect security password."
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7' } }),
}));

import WalletLockCard from '../src/screens/ai/WalletLockCard';

const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

const inputs = (t: renderer.ReactTestRenderer) =>
  t.root.findAllByType(TextInput);

const byLabel = (t: renderer.ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

const mount = async (props: Partial<React.ComponentProps<typeof WalletLockCard>> = {}) => {
  const spies = { onApprove: jest.fn(), onSetup: jest.fn(), onReject: jest.fn(), onUsePasscode: jest.fn(), onOpenSettings: jest.fn() };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<WalletLockCard lock busy={false} {...spies} {...props} />);
  });
  return { tree, spies };
};

describe('wallet lock card: first use', () => {
  it('asks for a password AND a re-entry, not for a password that does not exist', async () => {
    const { tree } = await mount({ noPassword: true });
    const fields = inputs(tree);
    expect(fields.length).toBe(2);
    expect(fields[0].props.placeholder).toMatch(/Security password/);
    expect(fields[1].props.placeholder).toBe('Re-enter password');
    expect(texts(tree)).toContain('Set password & Approve');
    await act(async () => { tree.unmount(); });
  });

  it('each field has its own hide/unhide eye', async () => {
    const { tree } = await mount({ noPassword: true });
    const before = inputs(tree).map((i) => i.props.secureTextEntry);
    expect(before).toEqual([true, true]);

    await act(async () => { byLabel(tree, 'Show password').props.onPress(); });
    expect(inputs(tree)[0].props.secureTextEntry).toBe(false);
    expect(inputs(tree)[1].props.secureTextEntry).toBe(true);   // eyes are independent

    await act(async () => { byLabel(tree, 'Show re-entered password').props.onPress(); });
    expect(inputs(tree)[1].props.secureTextEntry).toBe(false);

    await act(async () => { byLabel(tree, 'Hide password').props.onPress(); });
    expect(inputs(tree)[0].props.secureTextEntry).toBe(true);
    await act(async () => { tree.unmount(); });
  });

  it('refuses a mismatch, then saves the password when the two agree', async () => {
    const { tree, spies } = await mount({ noPassword: true });
    await act(async () => { inputs(tree)[0].props.onChangeText('hunter2!'); });
    await act(async () => { inputs(tree)[1].props.onChangeText('hunter3!'); });
    await act(async () => { byLabel(tree, 'Set password & Approve').props.onPress(); });
    expect(spies.onSetup).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Passwords do not match.');

    await act(async () => { inputs(tree)[1].props.onChangeText('hunter2!'); });
    await act(async () => { byLabel(tree, 'Set password & Approve').props.onPress(); });
    expect(spies.onSetup).toHaveBeenCalledWith('hunter2!');
    await act(async () => { tree.unmount(); });
  });
});

describe('wallet lock card: later locks', () => {
  it('asks for the existing password only, with an eye to check it', async () => {
    const { tree, spies } = await mount({ noPassword: false });
    expect(inputs(tree).length).toBe(1);
    expect(inputs(tree)[0].props.placeholder).toBe('Security password');
    await act(async () => { byLabel(tree, 'Show password').props.onPress(); });
    expect(inputs(tree)[0].props.secureTextEntry).toBe(false);
    await act(async () => { inputs(tree)[0].props.onChangeText('hunter2!'); });
    await act(async () => { byLabel(tree, 'Approve').props.onPress(); });
    expect(spies.onApprove).toHaveBeenCalledWith('hunter2!');
    await act(async () => { tree.unmount(); });
  });

  it('does not guess while the keychain is still being read', async () => {
    const { tree } = await mount({ checking: true });
    expect(inputs(tree).length).toBe(0);
    expect(texts(tree)).toContain('Checking this wallet…');
    await act(async () => { tree.unmount(); });
  });
});

describe('wallet lock card: optional passcode route', () => {
  it('offers "Use passcode" in the corner, in both states', async () => {
    const first = await mount({ noPassword: true });
    expect(byLabel(first.tree, 'Use passcode')).toBeTruthy();
    await act(async () => { byLabel(first.tree, 'Use passcode').props.onPress(); });
    expect(first.spies.onUsePasscode).toHaveBeenCalled();
    await act(async () => { first.tree.unmount(); });

    const later = await mount({ noPassword: false });
    expect(byLabel(later.tree, 'Use passcode')).toBeTruthy();
    await act(async () => { later.tree.unmount(); });
  });

  it('hides the corner button once the card is resolved', async () => {
    const { tree } = await mount({ noPassword: false, resolved: 'approved' as never });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Use passcode').length).toBe(0);
    await act(async () => { tree.unmount(); });
  });
});

describe('passcode sheet copy', () => {
  it('says wallet lock for a lock, never "transfer", and calls it the Veltravia passcode', async () => {
    jest.mock('../src/core/storage/passcode', () => ({ verifyPasscode: jest.fn(async () => true) }));
    const PasscodeConfirmSheet = require('../src/screens/ai/PasscodeConfirmSheet').default;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <PasscodeConfirmSheet
            visible
            title="Confirm wallet lock"
            message="Enter your Veltravia passcode to confirm this wallet lock."
            onCancel={() => {}}
            onVerified={() => {}}
          />
        </SafeAreaProvider>,
      );
    });
    const all = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(all).toContain('Confirm wallet lock');
    expect(all.some((t) => /Veltravia passcode/.test(t))).toBe(true);
    expect(all.some((t) => /transfer/i.test(t))).toBe(false);
    await act(async () => { tree.unmount(); });
  });
});
