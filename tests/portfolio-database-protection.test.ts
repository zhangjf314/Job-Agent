import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_DATABASE_NAME,
  assertPortfolioDatabaseUrl,
  parseEnvText,
  portfolioSafeTarget,
} from "@/scripts/portfolio-env";

describe("portfolio database protection", () => {
  it("accepts only the isolated portfolio database", () => {
    expect(assertPortfolioDatabaseUrl(
      "postgresql://user:secret@localhost:5432/personal_job_agent_portfolio",
    ).databaseName).toBe(PORTFOLIO_DATABASE_NAME);
  });

  it("rejects the main development database", () => {
    expect(() => assertPortfolioDatabaseUrl(
      "postgresql://user:secret@localhost:5432/personal_job_agent",
    )).toThrow("Refusing database operation");
  });

  it("rejects any unrelated database", () => {
    expect(() => assertPortfolioDatabaseUrl(
      "postgresql://user:secret@localhost:5432/postgres",
    )).toThrow("Refusing database operation");
  });

  it("fails when the Portfolio DATABASE_URL is missing", () => {
    expect(() => assertPortfolioDatabaseUrl(undefined)).toThrow(
      "Portfolio DATABASE_URL is missing",
    );
  });

  it("never prints credentials in the safe target", () => {
    const target = portfolioSafeTarget(
      "postgresql://private-user:private-password@localhost:5432/personal_job_agent_portfolio",
    );
    expect(target).toBe("localhost:5432/personal_job_agent_portfolio");
    expect(target).not.toMatch(/private|password/);
  });

  it("parses quoted environment values without exposing comments", () => {
    expect(parseEnvText('# x\nDATABASE_URL="postgresql://example"\nAI_PROVIDER=mock'))
      .toEqual({
        DATABASE_URL: "postgresql://example",
        AI_PROVIDER: "mock",
      });
  });

  it("keeps the local Portfolio environment ignored", () => {
    const ignore = readFileSync(resolve(".gitignore"), "utf8");
    expect(ignore).toContain(".env.portfolio.local");
  });

  it("ships only placeholder credentials in the example", () => {
    const example = readFileSync(resolve(".env.portfolio.example"), "utf8");
    expect(example).toContain("USER:PASSWORD");
    expect(example).not.toMatch(/sk-|Bearer|@example\.com/);
  });
});
