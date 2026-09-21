"use strict";
/**
 * lib/users.js
 * ---------------------------------------------------------------------------
 * User CRUD plus the safety rules that keep the CMS from locking itself out:
 * you can never delete or demote the very last admin account, and a
 * password change invalidates that user's other sessions.
 */

const { newId } = require("./store");
const { hashPassword, verifyPassword } = require("./passwords");
const { record: recordActivity } = require("./activity");

const ROLES = ["admin", "editor"];

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

async function findByUsername(db, username) {
  const norm = normalizeUsername(username);
  const all = await db.usersCol.list();
  return all.find((u) => normalizeUsername(u.username) === norm) || null;
}

async function countAdmins(db, excludingId = null) {
  const all = await db.usersCol.list();
  return all.filter((u) => u.role === "admin" && u.id !== excludingId).length;
}

async function createUser(db, { username, password, role }, actor) {
  const cleanUsername = String(username || "").trim();
  if (cleanUsername.length < 2) return { ok: false, reason: "Username must be at least 2 characters." };
  if (!ROLES.includes(role)) return { ok: false, reason: `Role must be one of: ${ROLES.join(", ")}.` };
  if (await findByUsername(db, cleanUsername)) return { ok: false, reason: "That username is already taken." };

  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    return { ok: false, reason: err.message };
  }

  const user = {
    id: newId("user"),
    username: cleanUsername,
    passwordHash,
    role,
    createdAt: Date.now(),
    createdBy: actor ? actor.username : null,
  };
  await db.usersCol.put(user.id, user);

  await recordActivity(db, {
    type: "user-created",
    actor,
    message: `${actor ? actor.username : "System"} created user ${cleanUsername} (${role})`,
    meta: { userId: user.id },
  });

  return { ok: true, user: toSafeUser(user) };
}

async function authenticate(db, username, password) {
  const user = await findByUsername(db, username);
  if (!user) {
    // Still run a hash operation so failed logins for a nonexistent username
    // take about as long as a wrong-password attempt (avoid a timing signal
    // that reveals which usernames exist).
    await verifyPassword(password || "", "scrypt$16384$8$1$00$00");
    return null;
  }
  const valid = await verifyPassword(password || "", user.passwordHash);
  return valid ? user : null;
}

async function updateUser(db, id, patch, actor) {
  const user = await db.usersCol.get(id);
  if (!user) return { ok: false, reason: "User not found." };

  const next = { ...user };
  let passwordChanged = false;

  if (patch.role && patch.role !== user.role) {
    if (!ROLES.includes(patch.role)) return { ok: false, reason: `Role must be one of: ${ROLES.join(", ")}.` };
    if (user.role === "admin" && patch.role !== "admin") {
      const remaining = await countAdmins(db, user.id);
      if (remaining < 1) return { ok: false, reason: "You can't remove the last remaining admin." };
    }
    next.role = patch.role;
  }

  if (patch.password) {
    try {
      next.passwordHash = await hashPassword(patch.password);
      passwordChanged = true;
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  await db.usersCol.put(id, next);

  if (passwordChanged) {
    await db.sessions.destroyAllForUser(id); // force re-login everywhere on password change
  }

  await recordActivity(db, {
    type: "permission-changed",
    actor,
    message: `${actor.username} updated user ${user.username}${patch.role ? ` -> role: ${patch.role}` : ""}${
      passwordChanged ? " (password reset)" : ""
    }`,
    meta: { userId: id },
  });

  return { ok: true, user: toSafeUser(next) };
}

async function deleteUser(db, id, actor) {
  const user = await db.usersCol.get(id);
  if (!user) return { ok: false, reason: "User not found." };
  if (actor && actor.id === id) return { ok: false, reason: "You can't delete your own account while logged in as it." };
  if (user.role === "admin") {
    const remaining = await countAdmins(db, user.id);
    if (remaining < 1) return { ok: false, reason: "You can't delete the last remaining admin." };
  }

  await db.usersCol.remove(id);
  await db.sessions.destroyAllForUser(id);

  await recordActivity(db, {
    type: "user-deleted",
    actor,
    message: `${actor.username} deleted user ${user.username}`,
    meta: { userId: id },
  });

  return { ok: true };
}

async function listUsersSafe(db) {
  const all = await db.usersCol.list();
  return all.map(toSafeUser).sort((a, b) => a.createdAt - b.createdAt);
}

async function hasAnyUsers(db) {
  const all = await db.usersCol.list();
  return all.length > 0;
}

module.exports = {
  ROLES,
  toSafeUser,
  findByUsername,
  createUser,
  authenticate,
  updateUser,
  deleteUser,
  listUsersSafe,
  hasAnyUsers,
  countAdmins,
};
