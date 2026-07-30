import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  PORTFOLIO_DATABASE_NAME,
  assertPortfolioDatabaseUrl,
  loadPortfolioEnv,
  portfolioSafeTarget,
} from "./portfolio-env";

function executable(name: string) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function findPsql() {
  const candidates = [
    process.env.PSQL_PATH,
    "D:\\PostgreSQL\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? "psql";
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit code ${result.status}: ${result.error?.message ?? "unknown error"}.`,
    );
  }
}

function ensureDatabase(databaseUrl: string) {
  const { parsed } = assertPortfolioDatabaseUrl(databaseUrl);
  const psql = findPsql();
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(parsed.password),
  };
  const args = [
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    parsed.hostname,
    "-p",
    parsed.port || "5432",
    "-U",
    decodeURIComponent(parsed.username),
    "-d",
    "postgres",
    "-tAc",
    `SELECT 1 FROM pg_database WHERE datname = '${PORTFOLIO_DATABASE_NAME}';`,
  ];
  const exists = execFileSync(psql, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim() === "1";
  if (exists) return;
  execFileSync(
    psql,
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      parsed.hostname,
      "-p",
      parsed.port || "5432",
      "-U",
      decodeURIComponent(parsed.username),
      "-d",
      "postgres",
      "-c",
      `CREATE DATABASE "${PORTFOLIO_DATABASE_NAME}";`,
    ],
    { env, stdio: ["ignore", "ignore", "pipe"] },
  );
}

function portfolioProcessEnv() {
  const values = loadPortfolioEnv({ initialize: true });
  return { ...process.env, ...values };
}

function seed(env: NodeJS.ProcessEnv) {
  run(executable("npx"), ["tsx", "scripts/portfolio-seed.ts"], env);
}

function setup() {
  const env = portfolioProcessEnv();
  const databaseUrl = env.DATABASE_URL!;
  ensureDatabase(databaseUrl);
  console.log(`Portfolio database target: ${portfolioSafeTarget(databaseUrl)}`);
  run(executable("npx"), ["prisma", "migrate", "deploy"], env);
  seed(env);
}

function reset() {
  const env = portfolioProcessEnv();
  assertPortfolioDatabaseUrl(env.DATABASE_URL);
  console.log(
    `Resetting isolated portfolio database: ${portfolioSafeTarget(env.DATABASE_URL!)}`,
  );
  run(
    executable("npx"),
    ["prisma", "migrate", "reset", "--force", "--skip-seed"],
    env,
  );
  seed(env);
}

function dev(extraArgs: string[]) {
  const env = portfolioProcessEnv();
  run(executable("npx"), ["next", "dev", ...extraArgs], env);
}

const [command, ...extraArgs] = process.argv.slice(2);
if (command === "setup") setup();
else if (command === "reset") reset();
else if (command === "dev") dev(extraArgs);
else throw new Error("Use portfolio-db.ts setup|reset|dev.");
