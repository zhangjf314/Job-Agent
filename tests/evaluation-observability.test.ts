import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  getEvaluationSummary,
  llmCallVisibilityWhere,
  safeLLMCallMetadata,
} from "@/services/evaluation-service";

describe("evaluation observability visibility and safety", () => {
  it("includes current-profile and profile-less logs", () => {
    expect(llmCallVisibilityWhere("profile-current")).toEqual({
      OR: [{ profileId: "profile-current" }, { profileId: null }],
    });
  });

  it("includes only profile-less logs when no current profile exists", () => {
    expect(llmCallVisibilityWhere()).toEqual({ profileId: null });
  });

  it("does not include another profile in the query", () => {
    expect(JSON.stringify(llmCallVisibilityWhere("profile-current")))
      .not.toContain("profile-other");
  });

  it("keeps only whitelisted metadata", () => {
    const safe = safeLLMCallMetadata({
      demo: true,
      generatedBy: "portfolio-seed",
      planJsonStatus: "passed",
      selectedFactCount: 8,
      prompt: "private",
      response: "private",
      reasoning_content: "private",
      sourceFactIds: ["F_PRIVATE"],
      apiKey: "secret",
    });
    expect(safe).toEqual({
      demo: true,
      generatedBy: "portfolio-seed",
      planJsonStatus: "passed",
      planSchemaStatus: undefined,
      planValidationStatus: undefined,
      compilerStatus: undefined,
      schemaStatus: undefined,
      factualityStatus: undefined,
      selectedFactCount: 8,
      renderedFactCount: undefined,
      omittedFactCount: undefined,
      sectionLineCounts: undefined,
      maximumLineLength: undefined,
      maximumSourceFactIds: undefined,
      factualityViolationCount: undefined,
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /prompt|response|reasoning|F_PRIVATE|apiKey|secret/,
    );
  });

  it("recognizes Demo metadata", () => {
    expect(safeLLMCallMetadata({
      demo: true,
      generatedBy: "portfolio-seed",
    })).toMatchObject({
      demo: true,
      generatedBy: "portfolio-seed",
    });
  });

  it("normalizes invalid metadata to a non-demo safe object", () => {
    expect(safeLLMCallMetadata("raw response")).toMatchObject({ demo: false });
  });

  it("uses the strict visibility filter and correct pagination", async () => {
    const calls = [{
      id: "log",
      profileId: null,
      operation: "tailored_resume_result",
      provider: "llm_provider",
      model: "demo",
      status: "success",
      durationMs: 100,
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCostMicros: null,
      errorCode: null,
      fallbackUsed: false,
      metadata: { demo: true },
      createdAt: new Date(),
    }];
    const evaluationFindMany = vi.fn().mockResolvedValue([]);
    const llmFindMany = vi.fn()
      .mockResolvedValueOnce(calls)
      .mockResolvedValueOnce(calls);
    const db = {
      evaluationRecord: { findMany: evaluationFindMany },
      lLMCallLog: { findMany: llmFindMany },
    } as unknown as PrismaClient;
    const summary = await getEvaluationSummary(
      "profile-current",
      db,
      { page: 2, pageSize: 10 },
    );
    expect(llmFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [{ profileId: "profile-current" }, { profileId: null }],
      },
    });
    expect(llmFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      skip: 10,
      take: 10,
    }));
    expect(summary.pagination).toEqual({ page: 2, pageSize: 10, count: 1 });
    expect(summary.recentCalls[0].safeMetadata.demo).toBe(true);
  });

  it("reports an empty state with zero calls", async () => {
    const db = {
      evaluationRecord: { findMany: vi.fn().mockResolvedValue([]) },
      lLMCallLog: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const summary = await getEvaluationSummary(undefined, db);
    expect(summary.llm.calls).toBe(0);
    expect(summary.recentCalls).toEqual([]);
  });
});
