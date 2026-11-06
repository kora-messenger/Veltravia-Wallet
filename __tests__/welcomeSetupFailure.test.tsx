/**
 * Returning from the passcode used to be a one-way door: if creating the wallet
 * failed, both buttons span forever with no message (Ijezie, 6 Nov 2026, after
 * typing his passcode on a real device). These pin the way out.
 */
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF',
      surface: '#FFFFFF', surfaceAlt: '#F2F2F5', border: '#E5E5EA',
      buttonGradient: ['#6C63FF', '#4A90D9'], brandGradient: ['#6C63FF', '#4A90D9'],
    },
    isDark: false,
  }),
}));
jest.mock('../src/services/browserState', () => ({ openInBrowser: jest.fn() }));
jest.mock('../src/core/security/deviceRemoval', () => ({ takeRemovalNotice: () => null }));
jest.mock('../src/services/connectivity', () => ({
  checkOnline: jest.fn(async () => ({ online: true })),
  offlineMessage: () => 'You are offline.',
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View };
});

import WelcomeScreen, { setupFailureMessage } from '../src/screens/onboarding/WelcomeScreen';

const mount = async (props: any) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<WelcomeScreen {...props} />); });
  return tree;
};

const buttonLoading = (tree: renderer.ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.label === label && typeof n.props.onPress === 'function')[0];
  return node.props.loading;
};

const pressLabel = async (tree: renderer.ReactTestRenderer, label: string) => {
  const node = tree.root.findAll((n) => n.props.label === label && typeof n.props.onPress === 'function')[0];
  expect(node).toBeTruthy();
  await act(async () => { node.props.onPress(); });
};

const note = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.testID === 'welcomeNetNote')[0];

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('returning from the passcode', () => {
  it('hands over to the next screen when the account is created', async () => {
    const onAutoLoadDone = jest.fn(async () => true);
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => {});
    expect(onAutoLoadDone).toHaveBeenCalledWith('create');
    expect(note(t)).toBeUndefined();
    await act(async () => { t.unmount(); });
  });

  it('stops the spinners and explains when creation fails', async () => {
    const onAutoLoadDone = jest.fn(async () => false);
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    expect(buttonLoading(t, 'Create a wallet')).toBe(true);
    await act(async () => { jest.advanceTimersByTime(2500); });

    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    expect(buttonLoading(t, 'I already have a wallet')).toBe(false);
    expect(note(t)).toBeTruthy();
    expect(JSON.stringify(note(t).props.children)).toContain("Couldn't finish setting up your wallet");
    await act(async () => { t.unmount(); });
  });

  it('says something actionable when the keystore has no biometrics', async () => {
    const onAutoLoadDone = jest.fn(async () => { throw new Error('Could not generate key: biometry not enrolled'); });
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => {});

    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    const msg = JSON.stringify(note(t).props.children);
    expect(msg).toMatch(/fingerprint or face unlock/i);
    await act(async () => { t.unmount(); });
  });

  it('gives up instead of spinning forever when creation hangs', async () => {
    const onAutoLoadDone = jest.fn(() => new Promise(() => {})); // never settles
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(buttonLoading(t, 'Create a wallet')).toBe(true); // still working, not yet failed

    await act(async () => { jest.advanceTimersByTime(25000); });
    await act(async () => {});
    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    expect(JSON.stringify(note(t).props.children)).toMatch(/took too long/i);
    await act(async () => { t.unmount(); });
  });

  it('leaves the tap path usable: the retry starts a real flow', async () => {
    const onCreate = jest.fn();
    const onAutoLoadDone = jest.fn(async () => false);
    const t = await mount({ onCreate, onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => {});

    const btn = t.root.findAll((n) => n.props.label === 'Create a wallet' && typeof n.props.onPress === 'function')[0];
    await act(async () => { btn.props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => { t.unmount(); });
  });

  it('does not touch anything when the passcode flow was not the entry point', async () => {
    const onAutoLoadDone = jest.fn();
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(onAutoLoadDone).not.toHaveBeenCalled();
    expect(note(t)).toBeUndefined();
    await act(async () => { t.unmount(); });
  });
});

describe('cancelling the passcode step', () => {
  it('clears spinners that a hanging tap left running when the user comes back', async () => {
    const connectivity = require('../src/services/connectivity');
    // a probe that never answers used to strand both buttons
    (connectivity.checkOnline as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    mockFocused = true;
    const onCreate = jest.fn();
    const t = await mount({ onCreate, onImport: jest.fn() });

    const btn = t.root.findAll((n) => n.props.label === 'Create a wallet' && typeof n.props.onPress === 'function')[0];
    mockFocused = false; // the passcode/prompt has taken over
    await act(async () => { btn.props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(buttonLoading(t, 'Create a wallet')).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();

    // back on this screen: nothing is pending, so nothing may keep spinning
    mockFocused = true;
    await act(async () => { t.update(<WelcomeScreen onCreate={onCreate} onImport={jest.fn()} />); });
    expect(buttonLoading(t, 'Create a wallet')).toBe(false);

    // and the tap path works again
    await act(async () => { btn.props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => { t.unmount(); });
  });

  it('leaves the buttons usable after the passcode step was cancelled', async () => {
    mockFocused = true;
    const onCreate = jest.fn();
    const t = await mount({ onCreate, onImport: jest.fn() });
    await pressLabel(t, 'I already have a wallet');
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => {});

    expect(onCreate).not.toHaveBeenCalled();
    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    expect(buttonLoading(t, 'I already have a wallet')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('never strands the buttons when the network probe itself throws', async () => {
    const connectivity = require('../src/services/connectivity');
    (connectivity.checkOnline as jest.Mock).mockRejectedValueOnce(new Error('NetInfo unavailable'));
    const onCreate = jest.fn();
    const t = await mount({ onCreate, onImport: jest.fn() });
    await pressLabel(t, 'Create a wallet');
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(onCreate).toHaveBeenCalled();          // unknown network: let it try
    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('releases the buttons when the passcode screen refuses to open', async () => {
    const onCreate = jest.fn(() => { throw new Error('navigator not ready'); });
    const t = await mount({ onCreate, onImport: jest.fn() });
    await pressLabel(t, 'Create a wallet');
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => {});
    expect(buttonLoading(t, 'Create a wallet')).toBe(false);
    expect(JSON.stringify(note(t).props.children)).toMatch(/Try again/);
    await act(async () => { t.unmount(); });
  });
});

describe('setupFailureMessage', () => {
  it('names the fix when biometrics are missing', () => {
    expect(setupFailureMessage(new Error('biometry not enrolled'))).toMatch(/fingerprint or face unlock/i);
    expect(setupFailureMessage(new Error('Could not generate key in keystore'))).toMatch(/fingerprint or face unlock/i);
  });

  it('shows the raw reason small, so a screenshot can be diagnosed', async () => {
    const onAutoLoadDone = jest.fn(async () => { throw new Error('Could not generate key in keystore: ERR_KEYGEN'); });
    const t = await mount({ onCreate: jest.fn(), onImport: jest.fn(), autoLoadFor: 'create', onAutoLoadDone });
    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => {});
    const reason = t.root.findAll((n) => n.props.testID === 'welcomeSetupReason')[0];
    expect(JSON.stringify(reason.props.children)).toContain('ERR_KEYGEN');
    await act(async () => { t.unmount(); });
  });

  it('is plain rather than technical for anything else', () => {
    expect(setupFailureMessage(new Error('ECONNRESET'))).toBe("Couldn't finish setting up your wallet. Try again.");
    expect(setupFailureMessage('timeout')).toMatch(/took too long/i);
  });
});
