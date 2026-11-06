package com.veltravia.wallet

import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactMethod
import java.security.SecureRandom

/**
 * The platform CSPRNG, exposed to JS.
 *
 * Hermes ships no `crypto.getRandomValues`, so a release build had no random
 * source at all: wallet creation stopped at "no CSPRNG available: refusing to
 * generate a nonce" (Ijezie, 6 Nov 2026). The guard in hash.ts was right to
 * refuse — minting a seed or a nonce from Math.random would be catastrophic —
 * so the fix is to give it a real one.
 *
 * `SecureRandom` is the Android platform CSPRNG (backed by /dev/urandom and, on
 * devices with a hardware RNG, by it). One instance is kept for the process:
 * SecureRandom is thread-safe and re-seeding per call is pointless overhead.
 *
 * `isBlockingSynchronousMethod` because `crypto.getRandomValues` is a
 * synchronous Web API: a promise-based bridge could not satisfy it. This method
 * returns 32 bytes or fewer in practice (nonces, IVs, salt), so the blocking
 * cost is a few microseconds.
 */
class RandomModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val random = SecureRandom()

  override fun getName() = "RandomModule"

  /**
   * Async twin of the method below.
   *
   * The blocking call is what the Web API needs, but a bridgeless/new-arch
   * host can refuse synchronous bridge calls. JS primes a pool from this at
   * startup, so there is always entropy to draw on even then.
   */
  @ReactMethod
  fun getRandomBase64Async(byteCount: Int, promise: Promise) {
    try {
      promise.resolve(getRandomBase64(byteCount))
    } catch (e: Throwable) {
      promise.reject("E_RANDOM", e)
    }
  }

  /** `byteCount` random bytes, base64 (no wrapping). */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getRandomBase64(byteCount: Int): String {
    if (byteCount <= 0) throw IllegalArgumentException("byteCount must be positive")
    if (byteCount > 1024) throw IllegalArgumentException("byteCount too large")
    val bytes = ByteArray(byteCount)
    random.nextBytes(bytes)
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
  }
}
