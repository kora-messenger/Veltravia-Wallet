#!/usr/bin/env node
/**
 * Build and sign an over-the-air JavaScript update.
 *
 *   node scripts/ota/publish.mjs --version 1.0.1 --min-app 1.0.0
 *
 * Output (dist/ota):
 *   bundle.js     the release bundle
 *   manifest.json the signed manifest the app checks
 *
 * The manifest is signed with the Ed25519 key in OTA_SIGNING_KEY (base64 of the
 * 64-byte secret key). If that variable is missing the script refuses to run:
 * an unsigned manifest is worthless, because every shipped app will reject it.
 *
 * Nothing here reaches the network. Upload the two files wherever OTA_BUNDLE_URL
 * points; the signature, not the host, is what the app trusts.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nacl from 'tweetnacl';

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = arg('version', pkg.version);
const minAppVersion = arg('min-app', '1.0.0');
const outDir = path.resolve(arg('out', 'dist/ota'));
const repo = process.env.GITHUB_REPOSITORY ?? 'kora-messenger/Veltravia-Wallet';
const tag = process.env.OTA_TAG ?? 'ota-latest';
const bundleUrl = process.env.OTA_BUNDLE_URL
  ?? `https://github.com/${repo}/releases/download/${tag}/bundle.js`;

const secretB64 = process.env.OTA_SIGNING_KEY;
if (!secretB64) {
  console.error('OTA_SIGNING_KEY is not set: refusing to publish an unsigned manifest.');
  process.exit(1);
}
const secretKey = Buffer.from(secretB64, 'base64');
if (secretKey.length !== nacl.sign.secretKeyLength) {
  console.error(`OTA_SIGNING_KEY must decode to ${nacl.sign.secretKeyLength} bytes, got ${secretKey.length}.`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const bundlePath = path.join(outDir, 'bundle.js');

console.log(`> bundling ${version} for android (release)`);
execFileSync(
  'npx',
  [
    'react-native', 'bundle',
    '--platform', 'android',
    '--dev', 'false',
    '--minify', 'true',
    '--entry-file', 'index.js',
    '--bundle-output', bundlePath,
    '--assets-dest', path.join(outDir, 'assets'),
  ],
  { stdio: 'inherit' },
);

const bytes = fs.readFileSync(bundlePath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const size = bytes.length;

// MUST match canonicalPayload() in src/core/ota/index.ts, byte for byte.
const payload = JSON.stringify({
  version,
  createdAt: arg('created-at', new Date().toISOString()),
  minAppVersion,
  url: bundleUrl,
  sha256,
  size,
});
const sig = Buffer.from(
  nacl.sign.detached(new Uint8Array(Buffer.from(payload, 'utf8')), new Uint8Array(secretKey)),
).toString('base64');

const manifest = {
  version,
  createdAt: JSON.parse(payload).createdAt,
  minAppVersion,
  bundle: { url: bundleUrl, sha256, size },
  sig,
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n  version   ${version}`);
console.log(`  sha256    ${sha256}`);
console.log(`  size      ${(size / 1024).toFixed(0)} KB`);
console.log(`  url       ${bundleUrl}`);
console.log(`  written   ${path.relative(process.cwd(), outDir)}/{bundle.js,manifest.json}`);
