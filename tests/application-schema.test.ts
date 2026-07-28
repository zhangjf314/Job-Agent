import { describe, expect, it } from "vitest";
import {
  applicationCreateInputSchema,
  applicationInsightSchema,
  interviewFeedbackAnalysisSchema,
  offerRecordSchema,
} from "@/schemas/application";

describe("application schemas", () => {
  it("validates application create input", () => {
    const parsed = applicationCreateInputSchema.parse({
      profileId: "profile_1",
      company: "Example Tech",
      jobTitle: "Java 后端开发",
      city: "杭州",
      channel: "online_platform",
      priority: "high",
    });
    expect(parsed.status).toBe("planned");
  });

  it("validates feedback analysis and insight output", () => {
    expect(interviewFeedbackAnalysisSchema.parse({
      strengths: ["项目表达清楚"],
      weaknesses: ["Redis 没答好"],
      questionsAsked: ["问了 Redis 缓存一致性"],
      knowledgeGaps: ["Redis"],
      improvementActions: ["补充 Redis 面试准备"],
      resumeImplications: [],
      strategyImplications: [],
      assumptions: [],
      warnings: [],
    }).knowledgeGaps).toContain("Redis");

    expect(applicationInsightSchema.parse({
      summary: "需要继续推进",
      currentRiskLevel: "medium",
      nextBestActions: ["补 Redis"],
      resumeSuggestions: [],
      interviewPrepSuggestions: [],
      followUpSuggestions: [],
      strategyImplications: [],
      warnings: [],
    }).currentRiskLevel).toBe("medium");
  });

  it("validates offer record", () => {
    const offer = offerRecordSchema.parse({
      company: "Example Tech",
      jobTitle: "软件开发工程师",
      salaryText: "18k*14",
      benefits: ["五险一金"],
      pros: ["技术栈匹配"],
      cons: [],
    });
    expect(offer.status).toBe("pending");
  });
});
