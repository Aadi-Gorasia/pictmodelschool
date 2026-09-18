"use strict";
/**
 * lib/passwords.js
 * ---------------------------------------------------------------------------
 * Password hashing.
 *
 * The spec asks for Argon2 or bcrypt. Both ship as native addons on npm,
 * and this project intentionally has zero npm dependencies (it must build
 * and run with nothing but `node`, no network required). Node's built-in
 * `crypto.scrypt` is a memory-hard, industry-standard KDF (RFC 7914) and is
 * a well-regarded alternative precisely for cases like this one. We use a
 * random 16-byte salt per user, N=16384/r=8/p=1 (interactive parameters,
 * similar cost to a good bcrypt work factor), a 64-byte derived key, and a
 * constant-time comparison on verify.
 */

const crypto = require("crypto");

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 128 * 16384 * 8 * 2 };

function scryptAsync(password, salt, params) {
  const opts = params || SCRYPT_PARAMS;
  const keylen = opts.keylen || SCRYPT_PARAMS.keylen;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Returns a self-describing hash string: scrypt$N$r$p$saltHex$hashHex */
async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt);
  const { N, r, p } = SCRYPT_PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(password, salt, { N: Number(nStr), r: Number(rStr), p: Number(pStr) });
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

module.exports = { hashPassword, verifyPassword };
