#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { checkTcp, getDatabaseUrl, loadDotEnv, parseDatabaseTarget } = require("./env-utils");

function run(command, args) {
  try {
    if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
      return { ok: true, value: execSync(`${command} ${args.join(" ")}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
    }
    return { ok: true, value: execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    return { ok: false, value: error.message };
  }
}

function line(status, label, detail) {
  console.log(`[${status}] ${label}${detail ? `: ${detail}` : ""}`);
}

function prismaClientExists() {
  return fs.existsSync(path.join(process.cwd(), "node_modules", ".prisma", "client", "index.js"));
}

async function main() {
  console.log("Personal Job Agent Doctor");
  const env = loadDotEnv();
  const node = run("node", ["--version"]);
  const npm = run("npm", ["--version"]);
  const docker = run("docker", ["--version"]);
  const compose = run("docker", ["compose", "version"]);

  line(node.ok ? "OK" : "ERROR", "Node.js", node.value);
  line(npm.ok ? "OK" : "ERROR", "npm", npm.value);
  line(env.exists ? "OK" : "WARN", ".env", env.exists ? env.envPath : "not found; copy .env.example to .env");

  const databaseUrl = getDatabaseUrl();
  line(databaseUrl ? "OK" : "ERROR", "DATABASE_URL", databaseUrl ? "configured" : "missing");
  line(docker.ok ? "OK" : "WARN", "Docker", docker.ok ? docker.value : "unavailable");
  line(compose.ok ? "OK" : "WARN", "Docker Compose", compose.ok ? compose.value : "unavailable");

  if (databaseUrl) {
    const target = parseDatabaseTarget(databaseUrl);
    const db = await checkTcp(target.host, target.port, 2000);
    line(db.ok ? "OK" : "ERROR", "Database", db.ok ? `${target.host}:${target.port} reachable` : `${target.host}:${target.port} not reachable (${db.error})`);
  }

  if (prismaClientExists()) {
    line("OK", "Prisma Client", "generated");
  } else {
    const prismaGenerate = run("npx", ["prisma", "generate"]);
    line(prismaGenerate.ok ? "OK" : "WARN", "Prisma Client generate", prismaGenerate.ok ? "completed" : "failed");
  }

  console.log("\nNext steps:");
  console.log("1. If using Docker, run: npm run db");
  console.log("2. If Docker image pull fails, try Docker Desktop network/proxy/registry mirror, docker login, or local PostgreSQL.");
  console.log("3. If using local/cloud PostgreSQL, update DATABASE_URL in .env.");
  console.log("4. Then run: npm run setup");
  console.log("5. Start the app with: npm run dev");
}

main().catch((error) => {
  console.error(`Doctor failed: ${error.message}`);
  process.exit(1);
});
