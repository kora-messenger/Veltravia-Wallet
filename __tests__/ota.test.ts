/**
 * The OTA channel is a door into the wallet's own code, so the rules are pinned
 * here: only a manifest signed by the pinned key is accepted, only a newer
 * version is installed, and nothing is installed when verification fails.
 *
 * The Kotlin half (download, hash, atomic swap, boot-attempt rollback) is
 * covered by the Android build; these tests cover every decision JS makes.
 */
import nacl from 'tweetnacl';

const Buffer_ = require('buffer').Buffer as any;

const mockNative = {
  state: jest.fn(async (): Promise<any> => ({ version: null, sha256: null, size: 0, attempts: 0, bundlePresent: false })),
  install: jest.fn(async (..._args: any[]): Promise<boolean> => true),
  confirmBoot: jest.fn(),
  clear: jest.fn(),
};
let mockHasNative = true;

jest.mock('react-native', () => ({
  get NativeModules() {
    return mockHasNative ? { VeltraviaOta: mockNative } : {};
  },
}));
jest.mock('react-native-config', () => ({ OTA_MANIFEST_URL: '' }), { virtual: true });

// eslint-disable-next-line import/first
import {
  manifestUrl,
  DEFAULT_MANIFEST_URL,
  canonicalPayload,
  verifyManifest,
  isNewer,
  checkForUpdate,
  confirmBoot,
  utf8Bytes,
} from '../src/core/ota';

const kp = nacl.sign.keyPair();
const pub = Buffer_.from(kp.publicKey).toString('base64');

const sign = (m: any) =>
  Buffer_.from(
    nacl.sign.detached(new Uint8Array(Buffer_.from(canonicalPayload(m), 'utf8')), kp.secretKey),
  ).toString('base64');

const baseManifest = (over: any = {}) => {
  const core = {
    version: '1.0.1',
    createdAt: '2026-11-06T10:00:00.000Z',
    minAppVersion: '1.0.0',
    bundle: { url: 'https://example.test/bundle.js', sha256: 'a'.repeat(64), size: 1234 },
    ...over,
  };
  return { ...core, sig: sign(core) };
};

beforeEach(() => {
  mockHasNative = true;
  mockNative.state.mockClear();
  mockNative.install.mockClear();
  mockNative.confirmBoot.mockClear();
  mockNative.state.mockResolvedValue({ version: null, sha256: null, size: 0, attempts: 0, bundlePresent: false });
  mockNative.install.mockResolvedValue(true);
});

describe('canonicalPayload', () => {
  it('is the exact shape the publisher signs', () => {
    const m = {
      version: '1.0.1',
      createdAt: '2026-11-06T10:00:00.000Z',
      minAppVersion: '1.0.0',
      bundle: { url: 'https://example.test/b.js', sha256: 'B'.repeat(64), size: 10 },
    };
    expect(canonicalPayload(m as any)).toBe(
      JSON.stringify({
        version: '1.0.1',
        createdAt: '2026-11-06T10:00:00.000Z',
        minAppVersion: '1.0.0',
        url: 'https://example.test/b.js',
        sha256: 'b'.repeat(64),
        size: 10,
      }),
    );
  });

  it('treats a missing minAppVersion as empty, not undefined', () => {
    expect(canonicalPayload({ version: '1', createdAt: 'x', bundle: { url: 'https://a/b', sha256: 'c'.repeat(64), size: 1 } } as any))
      .toContain('"minAppVersion":""');
  });
});

describe('verifyManifest', () => {
  it('accepts a correctly signed manifest', () => {
    const r = verifyManifest(baseManifest(), pub);
    expect(r.ok).toBe(true);
  });

  it('rejects a manifest that was edited after signing', () => {
    const m = baseManifest();
    const tampered = { ...m, bundle: { ...m.bundle, sha256: 'b'.repeat(64) } };
    const r = verifyManifest(tampered, pub);
    expect(r.ok).toBe(false);
    expect((r as any).reason).toMatch(/signature/);
  });

  it('rejects a bundle URL swapped to http', () => {
    const m = baseManifest({ bundle: { url: 'http://example.test/bundle.js', sha256: 'a'.repeat(64), size: 5 } });
    expect(verifyManifest(m, pub).ok).toBe(false);
  });

  it('rejects a different signing key', () => {
    const other = nacl.sign.keyPair();
    expect(verifyManifest(baseManifest(), Buffer_.from(other.publicKey).toString('base64')).ok).toBe(false);
  });

  it('rejects unsigned or malformed manifests', () => {
    expect(verifyManifest({ version: '1.0.1' }, pub).ok).toBe(false);
    expect(verifyManifest(null, pub).ok).toBe(false);
    const broken = { ...baseManifest(), sig: 'not base64 !!' };
    expect(verifyManifest(broken, pub).ok).toBe(false);
  });

  it('rejects a hash that is not a sha256', () => {
    const m = baseManifest({ bundle: { url: 'https://a/b.js', sha256: 'abc', size: 1 } });
    expect(verifyManifest(m, pub).ok).toBe(false);
  });
});

describe('manifestUrl', () => {
  it('falls back to the ota-latest release, so no build config is needed', () => {
    expect(manifestUrl()).toBe(DEFAULT_MANIFEST_URL);
    expect(DEFAULT_MANIFEST_URL).toMatch(/^https:\/\//);
  });
});

describe('isNewer', () => {
  it('compares numerically, not as strings', () => {
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
    expect(isNewer('1.0.9', '1.0.10')).toBe(false);
    expect(isNewer('1.0.1', '1.0.1')).toBe(false);
    expect(isNewer('2', '1.9.9')).toBe(true);
    expect(isNewer('1.0.1', null)).toBe(true);
  });
});

describe('checkForUpdate', () => {
  const okFetch = (manifest: any) => jest.fn(async () => ({ ok: true, json: async () => manifest }));

  it('does nothing without the native module (dev, or an older APK)', async () => {
    mockHasNative = false;
    const res = await checkForUpdate({ url: 'https://example.test/m.json', fetchImpl: okFetch(baseManifest()) as any });
    expect(res).toEqual({ status: 'no-native' });
  });

  it('does nothing when the channel is switched off', async () => {
    const fetchImpl = jest.fn();
    const res = await checkForUpdate({ url: '', fetchImpl: fetchImpl as any });
    expect(res.status).toBe('no-url');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the ota-latest release when no URL is given', async () => {
    const fetchImpl = okFetch(baseManifest());
    await checkForUpdate({ fetchImpl: fetchImpl as any, publicKeyB64: pub });
    expect(fetchImpl).toHaveBeenCalledWith(DEFAULT_MANIFEST_URL, expect.anything());
  });

  it('installs a newer, correctly signed bundle', async () => {
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: okFetch(baseManifest()) as any,
      publicKeyB64: pub,
    });
    expect(res).toEqual({ status: 'installed', version: '1.0.1' });
    expect(mockNative.install).toHaveBeenCalledWith(
      'https://example.test/bundle.js',
      'a'.repeat(64),
      '1.0.1',
    );
  });

  it('will not reinstall or downgrade', async () => {
    mockNative.state.mockResolvedValue({ version: '1.0.1', sha256: 'a'.repeat(64), size: 1, attempts: 0, bundlePresent: true });
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: okFetch(baseManifest()) as any,
      publicKeyB64: pub,
    });
    expect(res).toEqual({ status: 'up-to-date' });
    expect(mockNative.install).not.toHaveBeenCalled();
  });

  it('refuses a bundle that needs native code this APK does not have', async () => {
    const m = baseManifest({ minAppVersion: '9.0.0' });
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: okFetch(m) as any,
      publicKeyB64: pub,
      appVersion: '1.0.0',
    });
    expect(res.status).toBe('rejected');
    expect(mockNative.install).not.toHaveBeenCalled();
  });

  it('never installs an unsigned or tampered manifest', async () => {
    const tampered = { ...baseManifest(), version: '1.0.2' };
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: okFetch(tampered) as any,
      publicKeyB64: pub,
    });
    expect(res.status).toBe('rejected');
    expect(mockNative.install).not.toHaveBeenCalled();
  });

  it('reports a failed install rather than pretending', async () => {
    mockNative.install.mockResolvedValue(false);
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: okFetch(baseManifest()) as any,
      publicKeyB64: pub,
    });
    expect(res).toEqual({ status: 'failed' });
  });

  it('survives a dead update channel', async () => {
    const res = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: (async () => { throw new Error('offline'); }) as any,
      publicKeyB64: pub,
    });
    expect(res).toEqual({ status: 'failed' });
    const bad = await checkForUpdate({
      url: 'https://example.test/m.json',
      fetchImpl: (async () => ({ ok: false, json: async () => ({}) })) as any,
      publicKeyB64: pub,
    });
    expect(bad).toEqual({ status: 'failed' });
  });
});

describe('confirmBoot', () => {
  it('tells the native side the bundle rendered', () => {
    confirmBoot();
    expect(mockNative.confirmBoot).toHaveBeenCalled();
  });

  it('is harmless when the module is missing', () => {
    mockHasNative = false;
    expect(() => confirmBoot()).not.toThrow();
  });
});

describe('utf8Bytes', () => {
  it('encodes ASCII and multi-byte text like the publisher does', () => {
    expect([...utf8Bytes('abc')]).toEqual([97, 98, 99]);
    expect([...utf8Bytes('é')]).toEqual([0xc3, 0xa9]);
    expect([...utf8Bytes('€')]).toEqual([0xe2, 0x82, 0xac]);
  });
});
