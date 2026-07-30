import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluationRecordInputSchema, type EvaluationRecordInput } from "@/schemas/evaluation";

type DbClient = PrismaClient;

export type SafeLLMCallMetadata = {
  demo: boolean;
  generatedBy?: string;
  planJsonStatus?: string;
  planSchemaStatus?: string;
  planValidationStatus?: string;
  compilerStatus?: string;
  schemaStatus?: string;
  factualityStatus?: string;
  selectedFactCount?: number;
  renderedFactCount?: number;
  omittedFactCount?: number;
  sectionLineCounts?: number[];
  maximumLineLength?: number;
  maximumSourceFactIds?: number;
  factualityViolationCount?: number;
};

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

export function llmCallVisibilityWhere(profileId?: string) {
  return profileId
    ? { OR: [{ profileId }, { profileId: null }] }
    : { profileId: null };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function safeLLMCallMetadata(value: unknown): SafeLLMCallMetadata {
  const input = record(value);
  return {
    demo: input.demo === true,
    generatedBy: stringValue(input.generatedBy),
    planJsonStatus: stringValue(input.planJsonStatus),
    planSchemaStatus: stringValue(input.planSchemaStatus),
    planValidationStatus: stringValue(input.planValidationStatus),
    compilerStatus: stringValue(input.compilerStatus),
    schemaStatus: stringValue(input.schemaStatus),
    factualityStatus: stringValue(input.factualityStatus),
    selectedFactCount: numberValue(input.selectedFactCount),
    renderedFactCount: numberValue(input.renderedFactCount),
    omittedFactCount: numberValue(input.omittedFactCount),
    sectionLineCounts: Array.isArray(input.sectionLineCounts) &&
      input.sectionLineCounts.every((item) => typeof item === "number")
      ? input.sectionLineCounts as number[]
      : undefined,
    maximumLineLength: numberValue(input.maximumLineLength),
    maximumSourceFactIds: numberValue(input.maximumSourceFactIds),
    factualityViolationCount: numberValue(input.factualityViolationCount),
  };
}

export async function getEvaluationSummary(
  profileId?: string,
  db: DbClient = prisma,
  options: { page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const callWhere = llmCallVisibilityWhere(profileId);
  const [records, allLLMCalls, llmCalls] = await Promise.all([
    db.evaluationRecord.findMany({ where: profileId ? { profileId } : undefined }),
    db.lLMCallLog.findMany({ where: callWhere }),
    db.lLMCallLog.findMany({
      where: callWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const byType = Object.fromEntries(["jd_parsing", "match_scoring", "resume_suggestion"].map((type) => {
    const values = records.filter((item) => item.type === type && item.humanScore !== null);
    return [type, { count: values.length, averageScore: values.length ? Number((values.reduce((sum, item) => sum + (item.humanScore ?? 0), 0) / values.length).toFixed(2)) : null }];
  }));
  return {
    totalEvaluations: records.length,
    byType,
    llm: {
      calls: allLLMCalls.length,
      successfulCalls: allLLMCalls.filter((item) => item.status === "success").length,
      averageLatencyMs: allLLMCalls.length ? Math.round(allLLMCalls.reduce((sum, item) => sum + item.durationMs, 0) / allLLMCalls.length) : 0,
      totalTokens: allLLMCalls.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0),
      estimatedCostMicros: allLLMCalls.reduce((sum, item) => sum + (item.estimatedCostMicros ?? 0), 0),
    },
    recentCalls: llmCalls.map((call) => ({
      ...call,
      safeMetadata: safeLLMCallMetadata(call.metadata),
    })),
    pagination: {
      page,
      pageSize,
      count: allLLMCalls.length,
    },
  };
}
