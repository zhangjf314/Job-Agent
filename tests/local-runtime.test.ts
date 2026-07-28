import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DatabaseConnectionError, isDatabaseConnectionError, isDatabaseNotConfiguredError, toFriendlyError } from "@/lib/errors";
import { safeActionResult } from "@/lib/safe-action-result";

describe("local runtime robustness", () => {
  it("recognizes missing DATABASE_URL and P1001 connection errors", () => {
    expect(isDatabaseNotConfiguredError(new Error("Environment variable not found: DATABASE_URL"))).toBe(true);
    expect(isDatabaseConnectionError(new Error("P1001: Can't reach database server at localhost:5432"))).toBe(true);
    const friendly = toFriendlyError(new Error("P1001: Can't reach database server at localhost:5432"));
    expect(friendly).toBeInstanceOf(DatabaseConnectionError);
    expect(friendly.message).toContain("数据库连接失败");
  });

  it("safe action result returns readable message", async () => {
    const result = await safeActionResult(async () => {
      throw new Error("P1001: Can't reach database server at localhost:5432");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("数据库连接失败");
  });

  it("package scripts decouple app dev from docker compose", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.scripts["dev:app"]).toBe("next dev");
    expect(pkg.scripts.dev).not.toContain("docker compose");
    expect(pkg.scripts.db).toBe("node scripts/wait-for-db.js");
    expect(pkg.scripts["db:create"]).toContain("create-local-postgres-db.ps1");
    expect(pkg.scripts["db:docker"]).toContain("docker compose up -d postgres");
    expect(pkg.scripts.setup).toBe("node scripts/setup-local-postgres.js");
    expect(pkg.scripts["setup:docker"]).toContain("db:wait");
  });

  it("README documents Docker, local PostgreSQL and cloud PostgreSQL paths", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("方案 A：Docker PostgreSQL");
    expect(readme).toContain("方案 B：本机 PostgreSQL");
    expect(readme).toContain("方案 C：云 PostgreSQL");
    expect(readme).toContain("failed to fetch anonymous token");
    expect(readme).toContain("P1001");
  });

  it("doctor script does not crash without a reachable database", () => {
    const output = execFileSync("node", ["scripts/doctor.js"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "postgresql://user:pass@127.0.0.1:1/db?schema=public" },
    });
    expect(output).toContain("Personal Job Agent Doctor");
    expect(output).toContain("Database");
    expect(output).toContain("Next steps");
  }, 30000);
});
