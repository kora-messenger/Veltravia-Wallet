/**
 * Side-effect entry: give the JS engine a CSPRNG before anything asks for
 * randomness. Imported first in index.js, so the shim is in place before App
 * (and therefore before any wallet creation) is even required.
 */
import { csprngAvailable, installCsprng, primeCsprngPool } from './csprng';

const ok = installCsprng();
if (!ok) {
  // Loud on purpose: without this, wallet creation fails with a confusing
  // "Couldn't finish setting up" instead of naming the real problem.
  console.error('[csprng] no random source available; wallet creation will refuse to run');
} else if (!csprngAvailable()) {
  console.error('[csprng] shim installed but not answering');
}

// Belt and braces for bridgeless hosts that refuse synchronous bridge calls:
// pull entropy over the async method too, so the pool is never empty by the
// time a wallet is created.
primeCsprngPool().catch(() => {});
