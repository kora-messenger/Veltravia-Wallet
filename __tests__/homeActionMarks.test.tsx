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

import { SendIcon, ReceiveIcon, SwapIcon, BuyIcon } from '../src/components/icons';
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

    ['Send', 'Receive', 'Swap', 'Buy'].forEach((label) => {
      expect(tileMark(label).length).toBeGreaterThanOrEqual(1);
    });
    await act(async () => { tree.unmount(); });
  });
});

describe('SwapIcon and BuyIcon', () => {
  it.each([
    ['Swap', SwapIcon],
    ['Buy', BuyIcon],
  ])('%s draws the supplied mark at 26 dp, tinted by the caller', async (_name, Icon: any) => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Icon size={26} color="#6C63FF" />); });
    const img = tree.root.findAllByType(Image);
    expect(img.length).toBe(1);
    expect(img[0].props.style).toMatchObject({ width: 26, height: 26, tintColor: '#6C63FF' });
    expect(tree.root.findAll((n) => n.props && 'viewBox' in n.props).length).toBe(0);
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
  const nodeZlib = require('zlib') as { inflateSync: (b: any) => any };
  const Buffer_ = require('buffer').Buffer as any;
  const readPng = (name: string) => nodeFs.readFileSync(nodePath.join('.', 'assets', 'brand', name));

  /** Minimal RGBA PNG reader: IHDR + inflated IDAT, unfiltered. */
  const decode = (buf: any) => {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf[25];
    let offset = 8;
    const idat: any[] = [];
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
      offset += 12 + len;
    }
    const raw = nodeZlib.inflateSync(Buffer_.concat(idat));
    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const out = Buffer_.alloc(height * stride);
    let pos = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[pos++];
      const row = raw.subarray(pos, pos + stride); pos += stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[y * stride + x - bpp] : 0;
        const b = y > 0 ? out[(y - 1) * stride + x] : 0;
        const c = y > 0 && x >= bpp ? out[(y - 1) * stride + x - bpp] : 0;
        let v = row[x];
        if (filter === 1) v += a;
        else if (filter === 2) v += b;
        else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        out[y * stride + x] = v & 0xff;
      }
    }
    return { width, height, colorType, alphaAt: (x: number, y: number) => out[y * stride + x * bpp + 3] };
  };

  const inkOf = (name: string) => {
    const img = decode(readPng(name));
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (img.alphaAt(x, y) > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return {
      w: (maxX - minX + 1) / img.width,
      h: (maxY - minY + 1) / img.height,
      width: img.width,
      height: img.height,
      colorType: img.colorType,
    };
  };

  it('all four are 384 px RGBA squares that can be tinted', () => {
    ['send.png', 'receive.png', 'buy.png', 'swap.png'].forEach((name) => {
      const buf = readPng(name);
      expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(buf.readUInt32BE(16)).toBe(384);
      expect(buf.readUInt32BE(20)).toBe(384);
      expect(buf[25]).toBe(6);
      expect(buf.length).toBeLessThan(120 * 1024);
    });
  });

  it('keeps the ink the same size the old vector icons had', () => {
    // measured off the paths they replaced, stroke included, against a 24 box
    // the longest side of the ink is what reads as "the size of the icon"
    const longest = (name: string) => { const i = inkOf(name); return Math.max(i.w, i.h); };
    expect(longest('send.png')).toBeCloseTo(0.50, 1);
    expect(longest('receive.png')).toBeCloseTo(0.75, 1);
    expect(longest('swap.png')).toBeCloseTo(0.75, 1);
    expect(longest('buy.png')).toBeCloseTo(0.83, 1);
  });
});
