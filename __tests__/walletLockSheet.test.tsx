/**
 * Wallet Lock sheet — rebuilt against Ijezie's reference (31 Oct 2026).
 *
 * These pin BOTH halves of that change:
 *  - the new presentation (hero shield, status card, two separate warning
 *    cards, icon-led fields, one gradient action);
 *  - every behaviour the old sheet had, because a prettier screen that drops
 *    validation or the lock gate is a regression, not a redesign.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput, Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let mockThemeMode: 'light' | 'dark' = 'light';
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: mockThemeMode,
      ink: '#0F111A',
      inkMuted: '#8A8EA3',
      brand: '#6C63FF',
      brandGradient: ['#6C63FF', '#4A90D9'],
      background: '#FFFFFF',
      surface: '#F5F5F7',
    },
  }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({
    wallets: [],
    activeWallet: { id: 'w1', name: 'Veltravia Wallet', icon: 'shield', color: '#6C63FF', backedUp: false },
    setActiveWallet: jest.fn(),
  }),
}));
jest.mock('../src/core/storage/securityPassword', () => ({
  hasSecurityPassword: jest.fn(async () => false),
  setSecurityPassword: jest.fn(async () => {}),
  verifySecurityPassword: jest.fn(async () => true),
}));
jest.mock('../src/core/security/walletLock', () => ({
  refreshWalletLock: jest.fn(async () => false),
  setWalletLocked: jest.fn(async () => {}),
  walletLocked: jest.fn(async () => false),
}));
jest.mock('../src/core/security/lockRegistry', () => ({ publishLockState: jest.fn(async () => {}) }));
jest.mock('../src/core/security/biometrics', () => ({
  isBiometricUnlockEnabled: jest.fn(async () => true),
  promptBiometrics: jest.fn(async () => true),
}));
jest.mock('../src/screens/ai/PasscodeConfirmSheet', () => ({ visible }: { visible: boolean }) =>
  visible ? 'passcode-sheet' : null,
);

import WalletLockSheet from '../src/screens/wallet/WalletLockSheet';
import { showToast } from '../src/components/Toast';
import { hasSecurityPassword, setSecurityPassword, verifySecurityPassword } from '../src/core/storage/securityPassword';
import { refreshWalletLock, setWalletLocked } from '../src/core/security/walletLock';
import { promptBiometrics } from '../src/core/security/biometrics';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const mount = async (onClose = jest.fn()) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <WalletLockSheet visible onClose={onClose} />
      </SafeAreaProvider>,
    );
  });
  return tree;
};

const textOf = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

/** Host elements only: a composite and its host view both carry testID. */
const hosts = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props.testID === testID && typeof n.type === 'string');

const one = (tree: renderer.ReactTestRenderer, testID: string) => {
  const found = hosts(tree, testID);
  if (!found.length) throw new Error(`no host node with testID ${testID}`);
  return found[0];
};

/** The real TextInput behind a field (the composite wrapper has no handler). */
const input = (tree: renderer.ReactTestRenderer, testID: string) => {
  const found = tree.root.findAllByType(TextInput).filter((n) => n.props.testID === testID);
  if (!found.length) throw new Error(`no input with testID ${testID}`);
  return found[0];
};

const type = async (tree: renderer.ReactTestRenderer, testID: string, value: string) => {
  await act(async () => { input(tree, testID).props.onChangeText(value); });
};

/** Pressables hold onPress on the composite; the host View only carries testID. */
const button = (tree: renderer.ReactTestRenderer, testID: string) => {
  const found = tree.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function');
  if (!found.length) throw new Error(`no pressable with testID ${testID}`);
  return found[0];
};

const press = async (tree: renderer.ReactTestRenderer, testID: string) => {
  await act(async () => { await button(tree, testID).props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  (hasSecurityPassword as jest.Mock).mockResolvedValue(false);
  (verifySecurityPassword as jest.Mock).mockResolvedValue(true);
  (refreshWalletLock as jest.Mock).mockResolvedValue(false);
});

describe('Wallet Lock — the rebuilt presentation', () => {
  it('leads with the hero shield, the title and the product line', async () => {
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Wallet Lock');
    expect(txt).toContain('Veltravia Wallet');
    const img = tree.root.findAll((n) => typeof n.type === 'function' && n.props.source).length;
    expect(img).toBeGreaterThan(0); // the 3D shield asset, not a flat glyph
    await act(async () => { tree.unmount(); });
  });

  it('states the wallet status and what locking does', async () => {
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Status');
    expect(txt).toContain('Wallet is unlocked');
    expect(txt).toContain('Lock to pause sending and swapping across this wallet.');
    await act(async () => { tree.unmount(); });
  });

  it('keeps the warning readable and separate from the recovery note', async () => {
    const tree = await mount();
    expect(hosts(tree, 'lockWarningCard').length).toBe(1);
    expect(hosts(tree, 'recoveryNoteCard').length).toBe(1);
    const txt = textOf(tree);
    expect(txt).toMatch(/you may lose access to this wallet/);
    expect(txt).toMatch(/not responsible for any loss/);
    expect(txt).toContain('this password only unlocks this device');
    // Learn more is still a real link, not decoration
    const link = one(tree, 'lockWarningLearnMore');
    expect(link.props.accessibilityRole).toBe('link');
    await act(async () => { tree.unmount(); });
  });

  it('names the password section and both fields, with the eye toggle wired', async () => {
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Create your security password');
    expect(txt).toMatch(/separate from your passcode and biometrics/);

    const pw = input(tree, 'walletLockPassword');
    const confirm = input(tree, 'walletLockConfirm');
    expect(pw.props.placeholder).toBe('Password (min 6 characters)');
    expect(confirm.props.placeholder).toBe('Confirm password');
    expect(pw.props.secureTextEntry).toBe(true);

    const eye = button(tree, 'walletLockPasswordEye');
    expect(eye.props.accessibilityLabel).toBe('Show password');
    await act(async () => { eye.props.onPress(); });
    expect(input(tree, 'walletLockPassword').props.secureTextEntry).toBe(false);
    await act(async () => { tree.unmount(); });
  });

  it('one action button, disabled until both fields are filled', async () => {
    const tree = await mount();
    expect(one(tree, 'walletLockAction').props.accessibilityState.disabled).toBe(true);
    await type(tree, 'walletLockPassword', 'secret1');
    await type(tree, 'walletLockConfirm', 'secret1');
    expect(one(tree, 'walletLockAction').props.accessibilityState.disabled).toBe(false);
    await act(async () => { tree.unmount(); });
  });
});

describe('Wallet Lock — behaviour that must not regress', () => {
  it('refuses fewer than 6 characters', async () => {
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'abc');
    await type(tree, 'walletLockConfirm', 'abc');
    await press(tree, 'walletLockAction');
    expect(setSecurityPassword).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Use at least 6 characters.');
    await act(async () => { tree.unmount(); });
  });

  it('refuses a mismatched confirmation', async () => {
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'secret1');
    await type(tree, 'walletLockConfirm', 'secret2');
    await press(tree, 'walletLockAction');
    expect(setSecurityPassword).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Passwords do not match.');
    await act(async () => { tree.unmount(); });
  });

  it('saves a valid password and says so', async () => {
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'secret1');
    await type(tree, 'walletLockConfirm', 'secret1');
    await press(tree, 'walletLockAction');
    expect(setSecurityPassword).toHaveBeenCalledWith('w1', 'secret1');
    expect(showToast).toHaveBeenCalledWith('Security password set', { kind: 'success' });
    await act(async () => { tree.unmount(); });
  });

  it('does not save twice when the button is tapped again while busy', async () => {
    let release!: () => void;
    (setSecurityPassword as jest.Mock).mockImplementation(() => new Promise<void>((r) => { release = () => r(); }));
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'secret1');
    await type(tree, 'walletLockConfirm', 'secret1');
    const btn = button(tree, 'walletLockAction');
    await act(async () => { btn.props.onPress(); });
    await act(async () => { btn.props.onPress(); });
    await act(async () => { release(); });
    expect(setSecurityPassword).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });

  it('closes from the X', async () => {
    const onClose = jest.fn();
    const tree = await mount(onClose);
    await press(tree, 'walletLockClose');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });
});

describe('Wallet Lock — the lock gate itself', () => {
  it('shows the existing password step once a password exists', async () => {
    (hasSecurityPassword as jest.Mock).mockResolvedValue(true);
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Lock your wallet');
    expect(one(tree, 'walletLockAction').props.accessibilityLabel).toBe('Lock wallet');
    await act(async () => { tree.unmount(); });
  });

  it('locks after the password, biometrics and the registry hand-off', async () => {
    (hasSecurityPassword as jest.Mock).mockResolvedValue(true);
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'secret1');
    await press(tree, 'walletLockAction');
    expect(verifySecurityPassword).toHaveBeenCalledWith('w1', 'secret1');
    expect(promptBiometrics).toHaveBeenCalled();
    expect(setWalletLocked).toHaveBeenCalledWith('w1', true);
    expect(showToast).toHaveBeenCalledWith('Wallet locked', { kind: 'success' });
    await act(async () => { tree.unmount(); });
  });

  it('rejects the wrong password, clears the field and keeps the wallet open', async () => {
    (hasSecurityPassword as jest.Mock).mockResolvedValue(true);
    (verifySecurityPassword as jest.Mock).mockResolvedValue(false);
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'nope123');
    await press(tree, 'walletLockAction');
    expect(setWalletLocked).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Incorrect security password. Try again.');
    expect(input(tree, 'walletLockPassword').props.value).toBe('');
    await act(async () => { tree.unmount(); });
  });

  it('falls back to the passcode sheet when biometrics decline', async () => {
    (hasSecurityPassword as jest.Mock).mockResolvedValue(true);
    (promptBiometrics as jest.Mock).mockResolvedValue(false);
    const tree = await mount();
    await type(tree, 'walletLockPassword', 'secret1');
    await press(tree, 'walletLockAction');
    expect(setWalletLocked).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('passcode-sheet');
    await act(async () => { tree.unmount(); });
  });

  it('reads the real lock state and offers to unlock when locked', async () => {
    (hasSecurityPassword as jest.Mock).mockResolvedValue(true);
    (refreshWalletLock as jest.Mock).mockResolvedValue(true);
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Wallet is locked');
    expect(txt).toContain('Sending and swapping are paused until you unlock your wallet.');
    expect(one(tree, 'walletLockAction').props.accessibilityLabel).toBe('Unlock wallet');
    await act(async () => { tree.unmount(); });
  });
});

describe('Wallet Lock — the reference design, pinned', () => {
  const flat = (style: any) => Object.assign({}, ...[].concat(style).filter(Boolean));

  it('uses the colours sampled from the reference', async () => {
    const { LOCK_PALETTE } = require('../src/screens/wallet/WalletLockSheet');
    // sampled straight out of the mock (see the note at the top of the sheet)
    expect(LOCK_PALETTE.sheet).toBe('#F3F2F6');
    expect(LOCK_PALETTE.peach).toBe('#FCE9D6');
    expect(LOCK_PALETTE.greenDeep).toBe('#05784B');
    expect(LOCK_PALETTE.violet).toBe('#5B4CFB');
    // the action gradient: the mock's greens, darkened only as far as white
    // 15 sp text needs to stay at 4.5:1 (5.35:1 and 4.64:1)
    expect(LOCK_PALETTE.gradient).toEqual(['#0A7A55', '#0C855D']);
    await act(async () => {});
  });

  it('holds production dimensions for the cards, fields and button', async () => {
    const tree = await mount();
    // one consistent field height, rounded to 14
    const fields = tree.root.findAll(
      (n) => typeof n.type === 'string' && n.props.style && flat(n.props.style).height === 54 && flat(n.props.style).borderRadius === 14,
    );
    expect(fields.length).toBe(2);

    // the action is its own 54-high, 16-radius shell
    const action = button(tree, 'walletLockAction');
    const shell = flat(typeof action.props.style === 'function' ? action.props.style({ pressed: false }) : action.props.style);
    expect(shell.borderRadius).toBe(16);
    expect(tree.root.findAll((n) => typeof n.type === 'string' && flat(n.props.style).height === 54 && flat(n.props.style).borderRadius === 16).length)
      .toBeGreaterThanOrEqual(1);

    // cards are 18-radius
    const card = tree.root.findAll((n) => typeof n.type === 'string' && flat(n.props.style).borderRadius === 18);
    expect(card.length).toBe(2); // the status card and the warning card
    await act(async () => { tree.unmount(); });
  });

  it('ships the 3D shield asset, not a flat placeholder', () => {
    // node builtins via require: the app tsconfig carries no node types (RN app)
    const nodeFs = require('fs') as { readFileSync: (p: string) => any };
    const nodePath = require('path') as { join: (...parts: string[]) => string };
    const p = nodePath.join(nodePath.join('.', 'assets'), 'brand', 'wallet-lock-shield.png');
    const buf = nodeFs.readFileSync(p);
    expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(320);
    expect(height).toBe(254);
    // colour type 6 = RGBA, so the white mock backdrop was knocked out
    expect(buf[25]).toBe(6);
    // kept small enough to bundle
    expect(buf.length).toBeLessThan(200 * 1024);
  });
});


describe('Wallet Lock — layout on real devices', () => {
  afterEach(() => { mockThemeMode = 'light'; });

  it('renders the same content in dark mode instead of a white block', async () => {
    mockThemeMode = 'dark';
    const tree = await mount();
    const txt = textOf(tree);
    expect(txt).toContain('Wallet Lock');
    expect(txt).toContain('Create your security password');
    // the sheet surface itself flips rather than staying light
    const surfaces = tree.root.findAll(
      (n) => typeof n.type === 'string' && Object.assign({}, ...[].concat(n.props.style).filter(Boolean)).backgroundColor === '#0F1330',
    );
    expect(surfaces.length).toBe(1);
    await act(async () => { tree.unmount(); });
  });

  it('lifts the sheet above the keyboard so fields and the button stay visible', async () => {
    // capture the keyboard listeners the sheet registers
    const handlers: Record<string, (e: any) => void> = {};
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((evt: string, cb: any) => {
      handlers[evt] = cb;
      return { remove: jest.fn() };
    }) as any);

    const tree = await mount();
    const pad = () => {
      const scrim = tree.root.findAll(
        (n) => typeof n.type === 'string' && Object.assign({}, ...[].concat(n.props.style).filter(Boolean)).justifyContent === 'flex-end',
      )[0];
      return Object.assign({}, ...[].concat(scrim.props.style).filter(Boolean)).paddingBottom;
    };
    expect(pad()).toBe(0);

    await act(async () => {
      handlers.keyboardWillShow?.({ endCoordinates: { height: 320 } });
      handlers.keyboardDidShow?.({ endCoordinates: { height: 320 } });
    });
    expect(pad()).toBe(320);

    await act(async () => {
      handlers.keyboardWillHide?.({});
      handlers.keyboardDidHide?.({});
    });
    expect(pad()).toBe(0);
    spy.mockRestore();
    await act(async () => { tree.unmount(); });
  });

  it('keeps the body scrollable and respects the bottom safe area', async () => {
    const tree = await mount();
    const scrolls = tree.root.findAll((n) => n.props.keyboardShouldPersistTaps === 'handled');
    expect(scrolls.length).toBeGreaterThanOrEqual(1);
    // 34 dp inset from the metrics above
    const sheet = tree.root.findAll(
      (n) => typeof n.type === 'string' && Object.assign({}, ...[].concat(n.props.style).filter(Boolean)).borderTopLeftRadius === 28,
    )[0];
    expect(Object.assign({}, ...[].concat(sheet.props.style).filter(Boolean)).paddingBottom).toBe(34);
    await act(async () => { tree.unmount(); });
  });
});
