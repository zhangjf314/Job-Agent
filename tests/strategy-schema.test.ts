import { describe, expect, it } from "vitest";
import { careerStrategyGenerationResultSchema } from "@/schemas/strategy";

describe("strategy schema", () => {
  it("validates a generation result", () => {
    const result = careerStrategyGenerationResultSchema.safeParse({
      title: "策略计划",
      summary: "首推 Java 后端",
      targetTimeframe: "one_month",
      overallReadinessScore: 80,
      recommendedPrimaryDirection: "Java 后端开发",
      recommendedCities: ["杭州"],
      strategyNotes: ["规则生成"],
      recommendations: [{
        directionName: "Java 后端开发",
        roleFamily: "engineering",
        matchScore: 80,
        confidence: 90,
        priority: "high",
        suitableRoles: ["Java 后端"],
        suitableIndustries: ["互联网"],
        recommendedCities: ["杭州"],
        matchedEvidence: ["已有技能：Java"],
        gaps: [],
        risks: [],
        resumeFocus: ["突出项目"],
        searchKeywords: ["Java 后端"],
      }],
      skillGaps: [],
      jobSearchStrategies: [],
      actionPlan: [],
      warnings: [],
      assumptions: [],
    });
    expect(result.success).toBe(true);
  });
});
