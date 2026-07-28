import { z } from "zod";
import { evaluationTypes, llmCallStatuses } from "@/types/evaluation";

export const evaluationRecordInputSchema = z.object({
  profileId: z.string().trim().min(1),
  type: z.enum(evaluationTypes),
  entityId: z.string().trim().min(1),
  expectedOutput: z.unknown().optional(),
  actualOutput: z.unknown().optional(),
  humanScore: z.coerce.number().int().min(1).max(5).optional(),
  reviewerNotes: z.string().trim().max(2000).optional().default(""),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});

export const llmCallLogSchema = z.object({
  profileId: z.string().trim().optional(),
  operation: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  status: z.enum(llmCallStatuses),
  durationMs: z.number().int().min(0),
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  estimatedCostMicros: z.number().int().min(0).optional(),
  errorCode: z.string().trim().optional(),
  fallbackUsed: z.boolean().default(false),
  metadata: z.unknown().optional(),
});

export type EvaluationRecordInput = z.infer<typeof evaluationRecordInputSchema>;
export type LLMCallLogInput = z.infer<typeof llmCallLogSchema>;
