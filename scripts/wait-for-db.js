#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { checkTcp, getDatabaseUrl, parseDatabaseTarget } = require("./env-utils");

async function main() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error("DATABASE_URL is not configured. Copy .env.example to .env and update it.");
    process.exit(1);
  }

  const target = parseDatabaseTarget(databaseUrl);
  const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS || 60000);
  const startedAt = Date.now();
  process.stdout.write(`Waiting for PostgreSQL at ${target.host}:${target.port}`);

  while (Date.now() - startedAt < timeoutMs) {
    const result = await checkTcp(target.host, target.port, 1500);
    if (result.ok) {
      process.stdout.write("\nDatabase is reachable.\n");
      process.exit(0);
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.error(`\nDatabase is not reachable at ${target.host}:${target.port}.`);
  console.error("Next steps:");
  console.error("1. If using Docker, run: npm run db");
  console.error("2. If Docker image pull fails, use local/cloud PostgreSQL and update DATABASE_URL in .env.");
  console.error("3. Then run: npm run setup");
  process.exit(1);
}

main();
