/**
 * The fingerprint mark is Ijezie's supplied artwork (2026-11-06), not the old
 * hand-drawn swirl. It appears in three places — the lock screen keypad, the
 * onboarding passcode screen and the Biometric Login modal — so the contract is
 * pinned here once: one tintable bitmap, sized by the caller.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image, View } from 'react-native';

import { FingerprintIcon, FingerprintArt } from '../src/components/icons';

const mount = async (el: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(el); });
  return tree;
};

describe('FingerprintIcon', () => {
  it('draws the supplied asset at the size and colour it is asked for', async () => {
    const tree = await mount(<FingerprintIcon size={34} color="#6C63FF" />);
    const img = tree.root.findAllByType(Image);
    expect(img.length).toBe(1);
    expect(img[0].props.source).toBeTruthy();
    expect(img[0].props.style).toMatchObject({ width: 34, height: 34, tintColor: '#6C63FF' });
    await act(async () => { tree.unmount(); });
  });

  it('is a bitmap, not the old vector swirl', async () => {
    const tree = await mount(<FingerprintIcon size={24} color="#000" />);
    // no SVG nodes at all: a re-added hand-drawn glyph would fail this
    const svgs = tree.root.findAll((n) => typeof n.type === 'function' && n.props && 'viewBox' in n.props);
    expect(svgs.length).toBe(0);
    await act(async () => { tree.unmount(); });
  });

  it('follows the caller colour, so light and dark surfaces both work', async () => {
    const light = await mount(<FingerprintIcon size={24} color="#E7E9F5" />);
    expect(light.root.findAllByType(Image)[0].props.style.tintColor).toBe('#E7E9F5');
    await act(async () => { light.unmount(); });

    const brand = await mount(<FingerprintIcon size={24} color="#6C63FF" />);
    expect(brand.root.findAllByType(Image)[0].props.style.tintColor).toBe('#6C63FF');
    await act(async () => { brand.unmount(); });
  });
});

describe('FingerprintArt (Biometric Login)', () => {
  it('puts the same mark on the soft brand disc at ~66%', async () => {
    const tree = await mount(<FingerprintArt size={104} />);
    const disc = tree.root.findAllByType(View)[0];
    expect(disc.props.style).toMatchObject({ width: 104, height: 104, borderRadius: 52 });
    const img = tree.root.findAllByType(Image)[0];
    expect(img.props.style).toMatchObject({ width: 69, height: 69 }); // round(104 * 0.66)
    expect(img.props.style.tintColor).toBe('#6C63FF');
    await act(async () => { tree.unmount(); });
  });

  it('can take another accent without changing its geometry', async () => {
    const tree = await mount(<FingerprintArt size={80} color="#0E8A5F" />);
    const img = tree.root.findAllByType(Image)[0];
    expect(img.props.style.tintColor).toBe('#0E8A5F');
    expect(img.props.style.width).toBe(53); // round(80 * 0.66)
    await act(async () => { tree.unmount(); });
  });
});

describe('the asset itself', () => {
  const nodeFs = require('fs') as { readFileSync: (p: string) => any };
  const nodePath = require('path') as { join: (...parts: string[]) => string };
  const buf = nodeFs.readFileSync(nodePath.join('.', 'assets', 'brand', 'fingerprint.png'));

  it('is a square RGBA PNG big enough for a 104 dp modal', () => {
    expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.readUInt32BE(16)).toBe(384);
    expect(buf.readUInt32BE(20)).toBe(384);
    expect(buf[25]).toBe(6); // RGBA: tintColor needs alpha, not a painted background
  });

  it('stays small enough to bundle', () => {
    expect(buf.length).toBeLessThan(120 * 1024);
  });
});
