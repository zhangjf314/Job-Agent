#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { checkTcp, getDatabaseUrl, parseDatabaseTarget } = require("./env-utils");

function run(command, args) {
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    execSync(`${command} ${args.join(" ")}`, { stdio: "inherit" });
    return;
  }
  execFileSync(command, args, { stdio: "inherit" });
}

function prismaClientExists() {
  return fs.existsSync(path.join(process.cwd(), "node_modules", ".prisma", "client", "index.js"));
}

function findPsql() {
  const candidates = [
    process.env.PSQL_PATH,
    "D:\\PostgreSQL\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "psql";
}

function maskTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  return `${url.username}@${url.hostname}:${url.port || 5432}${url.pathname}`;
}

function runPsqlCheck(databaseUrl) {
  const url = new URL(databaseUrl);
  const psql = findPsql();
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password || "") };
  execFileSync(psql, [
    "-v", "ON_ERROR_STOP=1",
    "-h", url.hostname,
    "-p", String(url.port || 5432),
    "-U", decodeURIComponent(url.username),
    "-d", url.pathname.replace(/^\//, ""),
    "-c", "SELECT 1;",
  ], { stdio: ["ignore", "ignore", "pipe"], env });
}

function printHelp(reason, target) {
  console.error("\nDatabase setup cannot continue.");
  if (target) console.error(`Target: ${target}`);
  console.error(`Reason: ${reason}`);
  console.error("\nNext steps:");
  console.error("1. Run: npm run doctor");
  console.error("2. If the app user/database does not exist, run: npm run db:create");
  console.error("3. If PostgreSQL is on a different port, update POSTGRES_PORT and DATABASE_URL in .env.");
  console.error("4. If using cloud/local PostgreSQL with different credentials, update DATABASE_URL in .env.");
  console.error("5. Re-run: npm run setup");
}

async function main() {
  console.log("Generating Prisma Client...");
  if (prismaClientExists()) {
    console.log("Existing Prisma Client found. Skipping generate during setup.");
  } else {
    run("npm", ["run", "prisma:generate"]);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    printHelp("DATABASE_URL is missing. Copy .env.example to .env first.", null);
    process.exit(1);
  }

  const target = parseDatabaseTarget(databaseUrl);
  const masked = maskTarget(databaseUrl);
  console.log(`Checking TCP connection for ${target.host}:${target.port}...`);
  const tcp = await checkTcp(target.host, target.port, 3000);
  if (!tcp.ok) {
    printHelp(`Port is not reachable: ${tcp.error}`, masked);
    process.exit(1);
  }

  console.log(`Checking PostgreSQL authentication for ${masked}...`);
  try {
    runPsqlCheck(databaseUrl);
  } catch {
    const message = error.stderr ? String(error.stderr) : error.message;
    if (/password authentication failed|authentication failed|28P01/i.test(message)) {
      printHelp("Authentication failed. The app user/password in DATABASE_URL is wrong or the role does not exist.", masked);
    } else if (/database .* does not exist|3D000/i.test(message)) {
      printHelp("Database does not exist. Run npm run db:create.", masked);
    } else if (/role .* does not exist|28000/i.test(message)) {
      printHelp("Database role does not exist. Run npm run db:create.", masked);
    } else {
      printHelp(message.split("\n").filter(Boolean)[0] || "PostgreSQL connection check failed.", masked);
    }
    process.exit(1);
  }

  console.log("Database connection is valid. Running Prisma migrate and seed...");
  try {
    run("npm", ["run", "prisma:migrate"]);
  } catch {
    console.warn("Prisma migrate failed. This project does not include the original initial migration, so an empty local database may need prisma db push.");
    console.warn("Running prisma db push for local development database initialization...");
    run("npm", ["run", "prisma", "--", "db", "push", "--skip-generate"]);
  }
  run("npm", ["run", "seed"]);
}

main().catch((error) => {
  printHelp(error.message, null);
  process.exit(1);
});
