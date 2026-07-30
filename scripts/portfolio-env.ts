import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const PORTFOLIO_DATABASE_NAME = "personal_job_agent_portfolio";
export const PORTFOLIO_ENV_PATH = resolve(".env.portfolio.local");

export function parseEnvText(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

export function assertPortfolioDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error(
      "Portfolio DATABASE_URL is missing. Create .env.portfolio.local first.",
    );
  }
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (
    parsed.protocol !== "postgresql:" ||
    databaseName !== PORTFOLIO_DATABASE_NAME
  ) {
    throw new Error(
      `Refusing database operation: target must be ${PORTFOLIO_DATABASE_NAME}.`,
    );
  }
  return { parsed, databaseName };
}

export function initializePortfolioEnvFromDevelopment() {
  if (existsSync(PORTFOLIO_ENV_PATH)) return false;
  const developmentPath = resolve(".env");
  if (!existsSync(developmentPath)) {
    throw new Error(
      "Cannot initialize .env.portfolio.local because .env is missing.",
    );
  }
  const development = parseEnvText(readFileSync(developmentPath, "utf8"));
  const source = development.DATABASE_URL;
  if (!source) throw new Error("Development DATABASE_URL is missing.");
  const url = new URL(source);
  url.pathname = `/${PORTFOLIO_DATABASE_NAME}`;
  const output = [
    `DATABASE_URL=${url.toString()}`,
    "AI_PROVIDER=mock",
    "LLM_FALLBACK_TO_MOCK=false",
    "PORTFOLIO_DEMO_MODE=true",
    "DEMO_USER_EMAIL=lin.zhiyuan@example.com",
    "NEXT_PUBLIC_APP_URL=http://localhost:3100",
    "",
  ].join("\n");
  writeFileSync(PORTFOLIO_ENV_PATH, output, {
    encoding: "utf8",
    mode: 0o600,
  });
  return true;
}

export function loadPortfolioEnv(
  options: { initialize?: boolean } = {},
): Record<string, string> {
  if (options.initialize) initializePortfolioEnvFromDevelopment();
  if (!existsSync(PORTFOLIO_ENV_PATH)) {
    throw new Error(".env.portfolio.local does not exist.");
  }
  const values = parseEnvText(readFileSync(PORTFOLIO_ENV_PATH, "utf8"));
  assertPortfolioDatabaseUrl(values.DATABASE_URL);
  return {
    ...values,
    AI_PROVIDER: "mock",
    LLM_FALLBACK_TO_MOCK: "false",
    PORTFOLIO_DEMO_MODE: "true",
  };
}

export function portfolioSafeTarget(databaseUrl: string) {
  const { parsed, databaseName } = assertPortfolioDatabaseUrl(databaseUrl);
  return `${parsed.hostname}:${parsed.port || "5432"}/${databaseName}`;
}
