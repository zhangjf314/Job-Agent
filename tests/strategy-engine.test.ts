import { describe, expect, it } from "vitest";
import { createMockGraduateProfile } from "@/services/mock-profile";
import type { ResumeProfile } from "@/services/resume-generator";
import { recommendCareerDirections } from "@/services/career-direction-recommender";
import { calculateCareerReadiness } from "@/services/career-readiness";
import { analyzeSkillGaps } from "@/services/skill-gap-analyzer";
import { generateJobSearchStrategy } from "@/services/job-search-strategy-generator";
import { buildCareerStrategyResult } from "@/services/strategy-engine";

function profile(): ResumeProfile {
  const input = createMockGraduateProfile("user_1");
  return {
    id: "profile_1",
    userId: "user_1",
    targetStatus: input.targetStatus,
    targetRoles: input.targetRoles,
    targetCities: input.targetCities,
    expectedSalaryMin: input.expectedSalaryMin,
    expectedSalaryMax: input.expectedSalaryMax,
    personalSummary: input.personalSummary,
    profileCompletenessScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    basicInfo: { id: "basic_1", profileId: "profile_1", ...input.basicInfo! },
    educationItems: input.educationItems.map((item, index) => ({ id: `edu_${index}`, profileId: "profile_1", ...item })),
    skillItems: input.skillItems.filter((skill) => skill.name !== "RabbitMQ").map((item, index) => ({ id: `skill_${index}`, profileId: "profile_1", ...item })),
    projectItems: input.projectItems.map((item, index) => ({ id: `project_${index}`, profileId: "profile_1", ...item })),
    experienceItems: input.experienceItems.map((item, index) => ({ id: `exp_${index}`, profileId: "profile_1", ...item })),
    certificateItems: input.certificateItems.map((item, index) => ({ id: `cert_${index}`, profileId: "profile_1", ...item })),
    awardItems: input.awardItems.map((item, index) => ({ id: `award_${index}`, profileId: "profile_1", ...item })),
    evidenceItems: input.evidenceItems.map((item, index) => ({ id: `ev_${index}`, profileId: "profile_1", ...item })),
  } as ResumeProfile;
}

describe("strategy engine", () => {
  it("recommends Java backend or software development for mock profile", () => {
    const recommendations = recommendCareerDirections(profile());
    const topNames = recommendations.slice(0, 2).map((item) => item.directionName);
    expect(topNames).toEqual(expect.arrayContaining(["Java 后端开发"]));
    expect(recommendations[0].matchScore).toBeGreaterThan(0);
    expect(recommendations[0].matchedEvidence.join("\n")).toMatch(/Java|项目证据/);
  });

  it("keeps missing MQ as a gap instead of owned skill", () => {
    const java = recommendCareerDirections(profile()).find((item) => item.directionName === "Java 后端开发")!;
    expect(java.gaps.join("\n")).toContain("RabbitMQ");
    expect(java.matchedEvidence.join("\n")).not.toContain("RabbitMQ");
  });

  it("calculates readiness between 0 and 100", () => {
    const java = recommendCareerDirections(profile())[0];
    const score = calculateCareerReadiness(profile(), java, [{ qualityScore: 80 }], [{ matchScore: 75 }]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("generates search keywords for later manual job search", () => {
    const java = recommendCareerDirections(profile())[0];
    const strategy = generateJobSearchStrategy(profile(), java);
    expect(strategy.searchKeywords).toEqual(expect.arrayContaining(["Java 后端", "Spring Boot", "应届生", "杭州", "上海"]));
  });

  it("builds full career strategy result", () => {
    const result = buildCareerStrategyResult(profile(), [{ qualityScore: 82 }], [{ targetRole: "Java 后端开发", matchScore: 76 }]);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.skillGaps.length).toBeGreaterThan(0);
    expect(result.jobSearchStrategies.length).toBeGreaterThan(0);
    expect(result.actionPlan.length).toBeGreaterThan(0);
  });

  it("analyzes skill gaps with actions and evidence", () => {
    const java = recommendCareerDirections(profile()).find((item) => item.directionName === "Java 后端开发")!;
    const gaps = analyzeSkillGaps(profile(), java);
    expect(gaps[0].suggestedActions.length).toBeGreaterThan(0);
    expect(gaps[0].evidenceNeeded.length).toBeGreaterThan(0);
  });
});
