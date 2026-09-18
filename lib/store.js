"use strict";
/**
 * lib/store.js
 * ---------------------------------------------------------------------------
 * A tiny, dependency-free, crash-safe JSON document store.
 *
 * Why not SQLite? Node 22 ships an experimental `node:sqlite`, but it is
 * explicitly marked "might change at any time." For a local-first tool that
 * needs to be correct on the first try, a hand-rolled JSON store is easier
 * to reason about, trivial to inspect/back up (it's just files you can open
 * in a text editor), and has zero native-binding risk. Every read/write in
 * the app goes through this module, so swapping in SQLite later is a
 * contained change.
 *
 * Guarantees this module provides:
 *  - Atomic writes: every write goes to a temp file in the same directory,
 *    fsynced, then renamed over the target. A crash mid-write can never
 *    leave a half-written JSON file behind.
 *  - Serialized access: concurrent callers touching the *same* file are
 *    queued (a simple promise-chain mutex per path) so read-modify-write
 *    sequences (e.g. "load users, push a new one, save users") can't race
 *    within this single Node process. This is a local single-process app,
 *    so this is sufficient - it does not protect against a second OS
 *    process touching the same file, which this app never does.
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const locks = new Map(); // absolute path -> Promise chain tail

function withLock(absPath, fn) {
  const prev = locks.get(absPath) || Promise.resolve();
  const next = prev.then(fn, fn); // run fn regardless of prior outcome
  // Keep the chain alive but don't let a rejection break future callers.
  locks.set(
    absPath,
    next.then(
      () => {},
      () => {}
    )
  );
  return next;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Atomically write `data` (already a string or Buffer) to `absPath`.
 */
async function atomicWriteFile(absPath, data) {
  await ensureDir(path.dirname(absPath));
  const tmp = absPath + ".tmp-" + process.pid + "-" + crypto.randomBytes(4).toString("hex");
  const fh = await fsp.open(tmp, "w");
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fsp.rename(tmp, absPath);
}

/**
 * Read a JSON file, returning `fallback` if it does not exist yet.
 * A corrupt file throws (we never want to silently discard user data).
 */
async function readJson(absPath, fallback) {
  try {
    const raw = await fsp.readFile(absPath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw new Error(`Data file ${absPath} is corrupt or unreadable: ${err.message}`);
  }
}

async function writeJson(absPath, value) {
  const json = JSON.stringify(value, null, 2);
  await atomicWriteFile(absPath, json);
}

/**
 * A "collection" is a JSON file holding an object keyed by id:
 *   { [id]: {...record} }
 * This gives us cheap get/list/upsert/delete without a query engine, which
 * is all a local CMS's admin data actually needs.
 */
class Collection {
  constructor(absPath) {
    this.path = absPath;
  }

  async _load() {
    return readJson(this.path, {});
  }

  async _save(obj) {
    return writeJson(this.path, obj);
  }

  /** Run `fn(collectionObject)` under the file's lock; fn may mutate and return a value. */
  async transact(fn) {
    return withLock(this.path, async () => {
      const obj = await this._load();
      const result = await fn(obj);
      await this._save(obj);
      return result;
    });
  }

  async all() {
    return withLock(this.path, () => this._load());
  }

  async list() {
    const obj = await this.all();
    return Object.values(obj);
  }

  async get(id) {
    const obj = await this.all();
    return obj[id] || null;
  }

  async put(id, record) {
    return this.transact((obj) => {
      obj[id] = record;
      return record;
    });
  }

  async patch(id, patchFn) {
    return this.transact((obj) => {
      if (!obj[id]) return null;
      obj[id] = typeof patchFn === "function" ? patchFn(obj[id]) : { ...obj[id], ...patchFn };
      return obj[id];
    });
  }

  async remove(id) {
    return this.transact((obj) => {
      const existed = Boolean(obj[id]);
      delete obj[id];
      return existed;
    });
  }
}

/** A "document" is a single JSON value (object/array) at one path, e.g. design tokens. */
class Document {
  constructor(absPath, defaultValue) {
    this.path = absPath;
    this.defaultValue = defaultValue;
  }

  async read() {
    return withLock(this.path, () => readJson(this.path, this.defaultValue));
  }

  async write(value) {
    return withLock(this.path, () => writeJson(this.path, value));
  }

  async update(fn) {
    return withLock(this.path, async () => {
      const current = await readJson(this.path, this.defaultValue);
      const next = fn(current);
      await writeJson(this.path, next);
      return next;
    });
  }
}

/** Monotonically increasing counters (used for global version numbers etc.) shared in one small file. */
class Counters {
  constructor(absPath) {
    this.doc = new Document(absPath, {});
  }
  async next(name) {
    let value;
    await this.doc.update((counters) => {
      value = (counters[name] || 0) + 1;
      counters[name] = value;
      return counters;
    });
    return value;
  }
}

function newId(prefix) {
  const rand = crypto.randomBytes(9).toString("base64url");
  return prefix ? `${prefix}_${rand}` : rand;
}

module.exports = {
  Collection,
  Document,
  Counters,
  atomicWriteFile,
  readJson,
  writeJson,
  ensureDir,
  newId,
  withLock,
};
