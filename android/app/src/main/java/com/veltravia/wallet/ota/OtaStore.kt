package com.veltravia.wallet.ota

import android.content.Context
import java.io.File
import java.security.MessageDigest

/**
 * Where an over-the-air JavaScript bundle lives on the device, and the rules for
 * ever trusting it.
 *
 * The wallet's own code is the attacker's best target, so nothing here is
 * downloaded "because the server said so":
 *  - the manifest is Ed25519-signed and verified in JS against a key pinned in
 *    the app, and that signature covers the bundle's SHA-256;
 *  - the bundle is only installed if its bytes hash to that value;
 *  - a bundle that cannot boot three times is deleted, and the app falls back to
 *    the copy that shipped inside the APK.
 *
 * Nothing is written outside filesDir, and nothing is executable in the Android
 * sense: this is JavaScript loaded by the runtime that is already installed.
 */
object OtaStore {

    const val MAX_BOOT_ATTEMPTS = 3

    private const val DIR = "ota"
    private const val BUNDLE = "bundle.js"
    private const val TEMP = "bundle.tmp"
    private const val META = "meta.json"

    private fun dir(ctx: Context) = File(ctx.filesDir, DIR).apply { if (!exists()) mkdirs() }
    private fun bundleFile(ctx: Context) = File(dir(ctx), BUNDLE)
    private fun tempFile(ctx: Context) = File(dir(ctx), TEMP)
    private fun metaFile(ctx: Context) = File(dir(ctx), META)

    data class Meta(val version: String, val sha256: String, val size: Long, val attempts: Int)

    fun readMeta(ctx: Context): Meta? {
        val f = metaFile(ctx)
        if (!f.exists()) return null
        return try {
            val o = org.json.JSONObject(f.readText())
            Meta(
                version = o.optString("version"),
                sha256 = o.optString("sha256"),
                size = o.optLong("size"),
                attempts = o.optInt("attempts", 0),
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun writeMeta(ctx: Context, meta: Meta) {
        val o = org.json.JSONObject()
            .put("version", meta.version)
            .put("sha256", meta.sha256)
            .put("size", meta.size)
            .put("attempts", meta.attempts)
        val tmp = File(dir(ctx), "$META.tmp")
        tmp.writeText(o.toString())
        if (!tmp.renameTo(metaFile(ctx))) {
            metaFile(ctx).writeText(o.toString())
            tmp.delete()
        }
    }

    /**
     * The path the React runtime should load, or null to use the APK's bundle.
     * Called on every cold start, before any JS runs.
     */
    fun activeBundlePath(ctx: Context): String? {
        val meta = readMeta(ctx) ?: return null
        val file = bundleFile(ctx)
        if (!file.exists() || file.length() != meta.size) {
            clear(ctx)
            return null
        }
        // The bytes on disk must still be the bytes that were signed. Cheap
        // insurance against a partial write or a rogue process editing the file.
        if (sha256(file) != meta.sha256) {
            clear(ctx)
            return null
        }
        if (meta.attempts >= MAX_BOOT_ATTEMPTS) {
            // Installed, tried, never confirmed: this bundle is the reason the
            // app is not starting. Drop it and go back to the packaged copy.
            clear(ctx)
            return null
        }
        writeMeta(ctx, meta.copy(attempts = meta.attempts + 1))
        return file.absolutePath
    }

    /** The JS bundle booted and rendered: stop counting attempts. */
    fun confirmBoot(ctx: Context) {
        val meta = readMeta(ctx) ?: return
        if (meta.attempts != 0) writeMeta(ctx, meta.copy(attempts = 0))
    }

    /**
     * Verified download. The caller has already checked the signed manifest; this
     * refuses to install anything whose bytes do not match the signed SHA-256.
     */
    fun install(ctx: Context, url: String, sha256Expected: String, version: String): Boolean {
        val expected = sha256Expected.lowercase()
        if (!expected.matches(Regex("^[0-9a-f]{64}$"))) return false

        val temp = tempFile(ctx)
        temp.delete()
        val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        try {
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
            conn.requestMethod = "GET"
            conn.instanceFollowRedirects = true
            if (conn.responseCode != 200) return false
            conn.inputStream.use { input ->
                temp.outputStream().use { out -> input.copyTo(out, 64 * 1024) }
            }
        } catch (_: Exception) {
            temp.delete()
            return false
        } finally {
            conn.disconnect()
        }

        if (sha256(temp) != expected) {
            temp.delete()
            return false
        }

        val target = bundleFile(ctx)
        if (!temp.renameTo(target)) {
            // rename across the same directory should not fail; copy as a fallback
            temp.copyTo(target, overwrite = true)
            temp.delete()
        }
        writeMeta(ctx, Meta(version, expected, target.length(), attempts = 0))
        return true
    }

    fun clear(ctx: Context) {
        bundleFile(ctx).delete()
        tempFile(ctx).delete()
        metaFile(ctx).delete()
    }

    fun state(ctx: Context): Map<String, Any?> {
        val meta = readMeta(ctx)
        return mapOf(
            "version" to meta?.version,
            "sha256" to meta?.sha256,
            "size" to meta?.size,
            "attempts" to meta?.attempts,
            "bundlePresent" to bundleFile(ctx).exists(),
        )
    }

    fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buf)
                if (read <= 0) break
                digest.update(buf, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
