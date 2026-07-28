import { describe, expect, it } from "vitest";
import { evaluationRecordInputSchema, llmCallLogSchema } from "@/schemas/evaluation";

describe("evaluation schemas", () => {
  it("validates human quality ratings", () => {
    expect(evaluationRecordInputSchema.parse({ profileId: "p1", type: "jd_parsing", entityId: "jd1", humanScore: 5 }).humanScore).toBe(5);
    expect(evaluationRecordInputSchema.safeParse({ profileId: "p1", type: "jd_parsing", entityId: "jd1", humanScore: 6 }).success).toBe(false);
  });

  it("validates LLM latency and token telemetry", () => {
    expect(llmCallLogSchema.safeParse({ operation: "jd_analysis", provider: "llm_provider", model: "model", status: "success", durationMs: 120, totalTokens: 300 }).success).toBe(true);
  });
});
