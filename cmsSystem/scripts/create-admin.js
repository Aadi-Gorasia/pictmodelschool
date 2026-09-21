#!/usr/bin/env node
"use strict";
/**
 * scripts/create-admin.js
 * ---------------------------------------------------------------------------
 * Creates a user directly in the data store. There is deliberately no HTTP
 * signup endpoint - the only way to create the first account (or add more
 * later) is this script, run on the machine hosting the CMS.
 *
 * Usage:
 *   node scripts/create-admin.js
 *     -> interactive prompts (username, password with masked input, role)
 *
 *   node scripts/create-admin.js --username aadi --password "..." --role admin
 *     -> non-interactive, for scripting/first-time setup
 *
 *   ADMIN_USERNAME=aadi ADMIN_PASSWORD=... node scripts/create-admin.js
 *     -> same, via environment variables (handy for container entrypoints)
 */

const path = require("path");
const readline = require("readline");
const { createDb } = require("../lib/db");
const { createUser, listUsersSafe } = require("../lib/users");

const DATA_DIR = path.resolve(process.env.CMS_DATA_DIR || path.join(__dirname, "..", ".cms-data"));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

/** Reads a password from the TTY, echoing '*' instead of the real characters. */
function askPassword(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Not an interactive terminal (e.g. piped input) - fall back to a plain read.
      return ask(question).then(resolve);
    }
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let input = "";
    const onData = (char) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
        return;
      }
      if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }
      if (char === "\u007f" || char === "\b") {
        if (input.length) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      input += char;
      process.stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = createDb(DATA_DIR);

  let username = args.username || process.env.ADMIN_USERNAME;
  let password = args.password || process.env.ADMIN_PASSWORD;
  let role = args.role || process.env.ADMIN_ROLE || "admin";

  const existing = await listUsersSafe(db);

  console.log("Studio CMS - create a user");
  console.log("Data directory: " + DATA_DIR);
  if (existing.length) {
    console.log("Existing users: " + existing.map((u) => u.username + " (" + u.role + ")").join(", "));
  } else {
    console.log("No users exist yet - this will become the first admin.");
  }
  console.log("");

  if (!username) username = await ask("Username: ");
  if (!password) password = await askPassword("Password (min 8 characters): ");
  if (!args.role && !process.env.ADMIN_ROLE && existing.length > 0) {
    const roleAnswer = await ask("Role [admin/editor] (default admin): ");
    if (roleAnswer.trim()) role = roleAnswer.trim();
  }

  if (!["admin", "editor"].includes(role)) {
    console.error('Role must be "admin" or "editor". Got: ' + role);
    process.exit(1);
  }

  const result = await createUser(db, { username, password, role }, null);
  if (!result.ok) {
    console.error("Could not create user: " + result.reason);
    process.exit(1);
  }

  console.log("");
  console.log("Created " + result.user.role + ' user "' + result.user.username + '".');
  console.log("You can now log in at /_cms/login once the server is running (npm start).");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
