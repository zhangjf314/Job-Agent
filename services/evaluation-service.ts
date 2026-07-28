import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluationRecordInputSchema, type EvaluationRecordInput } from "@/schemas/evaluation";

type DbClient = PrismaClient;

function json(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function createEvaluationRecord(input: EvaluationRecordInput, db: DbClient = prisma) {
  const parsed = evaluationRecordInputSchema.parse(input);
  return db.evaluationRecord.create({
    data: {
      profileId: parsed.profileId,
      type: parsed.type,
      entityId: parsed.entityId,
      expectedOutput: json(parsed.expectedOutput),
      actualOutput: json(parsed.actualOutput),
      humanScore: parsed.humanScore,
      reviewerNotes: parsed.reviewerNotes || null,
      tags: parsed.tags,
    },
  });
}

export async function listEvaluationRecords(profileId?: string, db: DbClient = prisma) {
  return db.evaluationRecord.findMany({
    where: profileId ? { profileId } : undefined,
    include: { profile: { include: { basicInfo: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEvaluationSummary(profileId?: string, db: DbClient = prisma) {
  const [records, llmCalls] = await Promise.all([
    db.evaluationRecord.findMany({ where: profileId ? { profileId } : undefined }),
    db.lLMCallLog.findMany({ where: profileId ? { profileId } : undefined, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const byType = Object.fromEntries(["jd_parsing", "match_scoring", "resume_suggestion"].map((type) => {
    const values = records.filter((item) => item.type === type && item.humanScore !== null);
    return [type, { count: values.length, averageScore: values.length ? Number((values.reduce((sum, item) => sum + (item.humanScore ?? 0), 0) / values.length).toFixed(2)) : null }];
  }));
  return {
    totalEvaluations: records.length,
    byType,
    llm: {
      calls: llmCalls.length,
      successfulCalls: llmCalls.filter((item) => item.status === "success").length,
      averageLatencyMs: llmCalls.length ? Math.round(llmCalls.reduce((sum, item) => sum + item.durationMs, 0) / llmCalls.length) : 0,
      totalTokens: llmCalls.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0),
      estimatedCostMicros: llmCalls.reduce((sum, item) => sum + (item.estimatedCostMicros ?? 0), 0),
    },
    recentCalls: llmCalls.slice(0, 20),
  };
}
