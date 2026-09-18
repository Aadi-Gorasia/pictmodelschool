"use strict";
/**
 * lib/loginThrottle.js
 * ---------------------------------------------------------------------------
 * Simple in-memory brute-force mitigation for /auth/login. Tracks failed
 * attempts per (ip + username) key; each additional failure doubles the
 * lockout window (capped). This is intentionally in-memory only (resets on
 * restart) - it's a speed bump against automated guessing on a local tool,
 * not a distributed rate limiter.
 */

const attempts = new Map(); // key -> { count, lockedUntil }

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30 * 60 * 1000; // cap at 30 minutes
const MAX_TRACKED_KEYS = 5000; // guard against unbounded memory growth from spoofed keys

function key(ip, username) {
  return `${ip}::${String(username || "").trim().toLowerCase()}`;
}

function checkLocked(ip, username) {
  const k = key(ip, username);
  const rec = attempts.get(k);
  if (!rec) return { locked: false };
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMs: rec.lockedUntil - Date.now() };
  }
  return { locked: false };
}

function recordFailure(ip, username) {
  const k = key(ip, username);
  if (!attempts.has(k) && attempts.size >= MAX_TRACKED_KEYS) {
    // Evict the oldest-looking entry rather than grow unbounded.
    const firstKey = attempts.keys().next().value;
    if (firstKey) attempts.delete(firstKey);
  }
  const rec = attempts.get(k) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  const delay = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, rec.count - 3), MAX_DELAY_MS);
  // Only start locking after a few free attempts, so a single mistyped
  // password doesn't already feel like a penalty.
  rec.lockedUntil = rec.count > 3 ? Date.now() + delay : 0;
  attempts.set(k, rec);
}

function recordSuccess(ip, username) {
  attempts.delete(key(ip, username));
}

module.exports = { checkLocked, recordFailure, recordSuccess };
