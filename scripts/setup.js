#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const { checkTcp, getDatabaseUrl, parseDatabaseTarget } = require("./env-utils");

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function printDatabaseHelp(target, error) {
  console.error("\nDatabase is not reachable.");
  if (target) console.error(`Target: ${target.host}:${target.port}/${target.database}`);
  if (error) console.error(`Reason: ${error}`);
  console.error("\nThis is usually not a Next.js or Prisma schema error. PostgreSQL is not running or DATABASE_URL is wrong.");
  console.error("\nNext steps:");
  console.error("1. If using Docker PostgreSQL, run: npm run db");
  console.error("2. If Docker cannot pull postgres:16-alpine, fix Docker Hub/network/proxy/login/registry mirror, or use local PostgreSQL.");
  console.error("3. If using local/cloud PostgreSQL, update DATABASE_URL in .env.");
  console.error("4. Verify with: npm run doctor");
  console.error("5. Re-run: npm run setup");
}

async function main() {
  console.log("Generating Prisma Client...");
  run("npx", ["prisma", "generate"]);

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error("\nDATABASE_URL is missing. Copy .env.example to .env and configure PostgreSQL.");
    process.exit(1);
  }

  const target = parseDatabaseTarget(databaseUrl);
  console.log(`Checking database connection at ${target.host}:${target.port}...`);
  const db = await checkTcp(target.host, target.port, 3000);
  if (!db.ok) {
    printDatabaseHelp(target, db.error);
    process.exit(1);
  }

  console.log("Database is reachable. Running migration and seed...");
  run("npx", ["prisma", "migrate", "dev"]);
  run("npm", ["run", "seed"]);
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  process.exit(1);
});
