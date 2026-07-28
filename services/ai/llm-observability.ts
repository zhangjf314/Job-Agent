import { prisma } from "@/lib/prisma";
import { llmCallLogSchema, type LLMCallLogInput } from "@/schemas/evaluation";

export interface LLMCallObserver {
  record(input: LLMCallLogInput): Promise<void>;
}

export const noopLLMCallObserver: LLMCallObserver = { async record() {} };

export function createDatabaseLLMCallObserver(): LLMCallObserver {
  return {
    async record(input) {
      const parsed = llmCallLogSchema.parse(input);
      await prisma.lLMCallLog.create({
        data: {
          ...parsed,
          profileId: parsed.profileId || null,
          promptTokens: parsed.promptTokens ?? null,
          completionTokens: parsed.completionTokens ?? null,
          totalTokens: parsed.totalTokens ?? null,
          estimatedCostMicros: parsed.estimatedCostMicros ?? null,
          errorCode: parsed.errorCode || null,
          metadata: parsed.metadata === undefined ? undefined : JSON.parse(JSON.stringify(parsed.metadata)),
        },
      });
    },
  };
}
