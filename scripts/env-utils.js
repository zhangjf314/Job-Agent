/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

function loadDotEnv(cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env");
  const values = {};
  if (!fs.existsSync(envPath)) return { envPath, exists: false, values };
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    values[match[1]] = raw.replace(/^["']|["']$/g, "");
  }
  return { envPath, exists: true, values };
}

function getDatabaseUrl() {
  const loaded = loadDotEnv();
  return process.env.DATABASE_URL || loaded.values.DATABASE_URL || "";
}

function parseDatabaseTarget(databaseUrl) {
  if (!databaseUrl) return null;
  const url = new URL(databaseUrl);
  return {
    host: url.hostname || "localhost",
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
  };
}

function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, `Timed out connecting to ${host}:${port}`));
    socket.once("error", (error) => finish(false, error.message));
    socket.connect(port, host);
  });
}

module.exports = {
  checkTcp,
  getDatabaseUrl,
  loadDotEnv,
  parseDatabaseTarget,
};
