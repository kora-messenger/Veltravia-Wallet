/**
 * The Home quick actions draw Ijezie's supplied artwork (2026-11-06): the paper
 * plane for Send, the arrow-over-line for Receive, instead of the old vectors.
 * This pins the asset contract and, more importantly, that the Home row actually
 * uses them — a component swap nobody wired up would otherwise pass silently.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, Animated } from 'react-native';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: require('../src/theme/tokens').themes.light }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));
jest.mock('../src/core/security/walletLock', () => ({
  refreshWalletLocks: jest.fn(async () => ({})),
  walletLocked: jest.fn(() => false),
  refreshWalletLock: jest.fn(async () => false),
  isWalletLocked: jest.fn(async () => false),
}));
jest.mock('../src/core/security/lockRegistry', () => ({
  refreshRegistryLock: jest.fn(async () => null),
  lockedElsewhere: jest.fn(() => null),
  publishLockState: jest.fn(async () => {}),
}));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({
    wallets: [{ id: 'w1', name: 'Veltravia Wallet', icon: 'shield', color: '#6C63FF', backedUp: false }],
    activeWallet: { id: 'w1', name: 'Veltravia Wallet', icon: 'shield', color: '#6C63FF', backedUp: false },
    setActiveWallet: jest.fn(),
    reload: jest.fn(async () => {}),
    createWallet: jest.fn(),
  }),
}));

const realEvent = Animated.event;
beforeAll(() => {
  (Animated as any).event = (mapping: any, cfg: any) => realEvent(mapping, { ...cfg, useNativeDriver: false });
});
afterAll(() => { (Animated as any).event = realEvent; });

import { SendIcon, ReceiveIcon } from '../src/components/icons';
import HomeScreen from '../src/screens/HomeScreen';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };

describe('SendIcon', () => {
  it('draws the supplied bitmap at the caller size and colour', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<SendIcon size={26} color="#FFFFFF" />); });
    const img = tree.root.findAllByType(Image);
    expect(img.length).toBe(1);
    expect(img[0].props.source).toBeTruthy();
    expect(img[0].props.style).toMatchObject({ width: 26, height: 26, tintColor: '#FFFFFF' });
    await act(async () => { tree.unmount(); });
  });

  it('is the bitmap, not the old diagonal arrow', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<SendIcon size={24} color="#000" />); });
    expect(tree.root.findAll((n) => n.props && 'viewBox' in n.props).length).toBe(0);
    await act(async () => { tree.unmount(); });
  });
});

describe('Home quick actions', () => {
  it('both tiles use the supplied artwork', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={metrics}>
          <HomeScreen navigation={{ navigate: jest.fn() }} />
        </SafeAreaProvider>,
      );
    });

    const tileMark = (labelText: string) => {
      const label = tree.root.findAll((n) => n.props.children === labelText)[0];
      expect(label).toBeTruthy();
      let tile: any = label;
      while (tile && !(tile.props && typeof tile.props.onPress === 'function')) tile = tile.parent;
      expect(tile).toBeTruthy();
      return tile.findAllByType(Image).filter((n: any) => n.props.style && n.props.style.tintColor);
    };

    expect(tileMark('Send').length).toBeGreaterThanOrEqual(1);
    expect(tileMark('Receive').length).toBeGreaterThanOrEqual(1);
    // and the other two tiles are still vector, so this is not just "some image"
    expect(tileMark('Swap').length).toBe(0);
    await act(async () => { tree.unmount(); });
  });
});

describe('ReceiveIcon', () => {
  it('draws the supplied linear mark at the caller size and colour', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<ReceiveIcon size={26} color="#FFFFFF" />); });
    const img = tree.root.findAllByType(Image);
    expect(img.length).toBe(1);
    expect(img[0].props.style).toMatchObject({ width: 26, height: 26, tintColor: '#FFFFFF' });
    await act(async () => { tree.unmount(); });
  });

  it('is the bitmap, not the old drawn arrow', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<ReceiveIcon size={26} color="#000" />); });
    expect(tree.root.findAll((n) => n.props && 'viewBox' in n.props).length).toBe(0);
    await act(async () => { tree.unmount(); });
  });
});

describe('the assets themselves', () => {
  const nodeFs = require('fs') as { readFileSync: (p: string) => any };
  const nodePath = require('path') as { join: (...parts: string[]) => string };
  const readPng = (name: string) => nodeFs.readFileSync(nodePath.join('.', 'assets', 'brand', name));
  const buf = readPng('send.png');
  const recv = readPng('receive.png');

  it('is a square RGBA PNG that can be tinted', () => {
    expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.readUInt32BE(16)).toBe(384);
    expect(buf.readUInt32BE(20)).toBe(384);
    expect(buf[25]).toBe(6);
  });

  it('the receive mark matches the same contract', () => {
    expect([...recv.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(recv.readUInt32BE(16)).toBe(384);
    expect(recv.readUInt32BE(20)).toBe(384);
    expect(recv[25]).toBe(6);
  });

  it('both stay small enough to bundle', () => {
    expect(buf.length).toBeLessThan(120 * 1024);
    expect(recv.length).toBeLessThan(120 * 1024);
  });
});
