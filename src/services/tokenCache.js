/**
 * In-memory JWT token cache.
 *
 * Structure:
 *   key   -> jti (JWT ID) embedded in each token payload
 *   value -> { userId: number, expiresAt: Date }
 *
 * Nothing is written to disk or the database.
 */

// Map<jti, { userId: number, expiresAt: Date }>
const tokenMap = new Map();

// Auto-cleanup interval: every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Register a newly issued token in the cache.
 * @param {string} jti       - Unique token ID (from JWT payload).
 * @param {number} userId    - The user this token belongs to.
 * @param {Date}   expiresAt - When the token expires.
 */
function addToken(jti, userId, expiresAt) {
  tokenMap.set(jti, { userId, expiresAt });
}

/**
 * Check whether a token is present and not yet expired.
 * Performs lazy eviction when an expired entry is found.
 * @param {string} jti
 * @returns {boolean}
 */
function hasToken(jti) {
  const entry = tokenMap.get(jti);
  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    tokenMap.delete(jti); // lazy eviction
    return false;
  }
  return true;
}

/**
 * Immediately remove a single token (e.g. on logout).
 * @param {string} jti
 */
function revokeToken(jti) {
  tokenMap.delete(jti);
}

/**
 * Remove all tokens for a given user (e.g. when account is archived/deleted).
 * @param {number} userId
 */
function revokeAllForUser(userId) {
  for (const [jti, entry] of tokenMap) {
    if (entry.userId === userId) tokenMap.delete(jti);
  }
}

/**
 * Sweep and delete all expired entries (called automatically on interval).
 */
function purgeExpired() {
  const now = new Date();
  for (const [jti, entry] of tokenMap) {
    if (now > entry.expiresAt) tokenMap.delete(jti);
  }
}

/** Number of active tokens currently cached (for diagnostics). */
function size() {
  return tokenMap.size;
}

// ─── Background cleanup ───────────────────────────────────────────────────────
const _timer = setInterval(purgeExpired, CLEANUP_INTERVAL_MS);
if (_timer.unref) _timer.unref(); // allow process to exit cleanly

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { addToken, hasToken, revokeToken, revokeAllForUser, purgeExpired, size };
