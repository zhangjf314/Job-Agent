/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/empty-state";
import { getAppConfig, hasDatabaseUrl } from "@/lib/config";
import { DatabaseNotConfiguredError, isDatabaseNotConfiguredError } from "@/lib/errors";
import { getCurrentUser } from "@/services/auth/current-user";
import { assertApplicationOwnership, assertProfileOwnership, assertResumeOwnership } from "@/services/auth/ownership";
import { getDashboardSummary } from "@/services/dashboard-service";
import { buildDemoJobTexts } from "@/services/demo-seed-service";
import { deleteUserData, exportUserData } from "@/services/user-data-service";

describe("MVP hardening helpers", () => {
  it("reads config defaults", () => {
    const config = getAppConfig({});
    expect(config.demoUserEmail).toBe("demo@example.com");
    expect(config.searchProvider).toBe("fixture");
    expect(config.enableRealWebSearch).toBe(false);
  });

  it("detects missing DATABASE_URL with friendly error", () => {
    expect(hasDatabaseUrl({})).toBe(false);
    expect(isDatabaseNotConfiguredError(new DatabaseNotConfiguredError())).toBe(true);
    expect(isDatabaseNotConfiguredError(new Error("Environment variable not found: DATABASE_URL"))).toBe(true);
  });

  it("gets current demo user through provider", async () => {
    const db = { user: { upsert: async ({ where }: any) => ({ id: "u1", email: where.email, name: "Demo User" }) } } as any;
    const user = await getCurrentUser(db);
    expect(user.email).toBe("demo@example.com");
  });

  it("checks ownership for profile, resume and application", async () => {
    const db = {
      careerProfile: { findUnique: async () => ({ id: "p1", userId: "u1" }) },
      resume: { findUnique: async () => ({ id: "r1", profile: { userId: "u1" } }) },
      application: { findUnique: async () => ({ id: "a1", profile: { userId: "u1" } }) },
    } as any;
    await expect(assertProfileOwnership("u1", "p1", db)).resolves.toMatchObject({ id: "p1" });
    await expect(assertResumeOwnership("other", "r1", db)).rejects.toThrow("无权访问");
    await expect(assertApplicationOwnership("u1", "a1", db)).resolves.toMatchObject({ id: "a1" });
  });

  it("returns user data export and deletes user data", async () => {
    const db = {
      user: {
        findUniqueOrThrow: async () => ({ id: "u1", email: "demo@example.com", profiles: [{ id: "p1" }] }),
        delete: async ({ where }: any) => ({ id: where.id }),
      },
    } as any;
    const exported = await exportUserData("u1", db);
    expect(exported.user.profiles).toHaveLength(1);
    await expect(deleteUserData("u1", db)).resolves.toMatchObject({ id: "u1" });
  });

  it("calculates dashboard summary", async () => {
    const db = {
      careerProfile: { findMany: async () => [{ id: "p1" }] },
      resume: { count: async () => 2 },
      jDAnalysis: { count: async () => 1 },
      careerStrategyPlan: { count: async () => 1 },
      jobMatch: { count: async () => 3 },
      application: { findMany: async () => [{ status: "planned" }, { status: "interviewing" }] },
      applicationTask: { findMany: async () => [{ id: "t1", title: "准备面试", status: "todo" }] },
      actionPlanItem: { findMany: async () => [] },
    } as any;
    const summary = await getDashboardSummary("u1", db);
    expect(summary.profileCount).toBe(1);
    expect(summary.funnel.planned).toBe(1);
    expect(summary.funnel.interviewing).toBe(1);
  });

  it("provides repeatable seed fixture coverage", () => {
    const jobs = buildDemoJobTexts();
    expect(jobs.length).toBeGreaterThanOrEqual(5);
    expect(jobs.join("\n")).toContain("培训贷");
    expect(jobs.join("\n")).toContain("Java");
  });

  it("renders empty state", () => {
    render(<EmptyState title="暂无数据" description="请先创建职业档案" actionHref="/profile/new" actionLabel="创建" />);
    expect(screen.getByText("暂无数据")).toBeTruthy();
    expect(screen.getByText("创建")).toBeTruthy();
  });
});
