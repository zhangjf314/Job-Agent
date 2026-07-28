import { describe, expect, it } from "vitest";
import { createMockGraduateProfile } from "@/services/mock-profile";
import {
  detectResumeMissingFields,
  generateResumeFromProfile,
  optimizeProjectBullets,
  type ResumeProfile,
} from "@/services/resume-generator";
import { calculateResumeQualityScore } from "@/services/resume-quality";

function profile(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
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
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    basicInfo: { id: "basic_1", profileId: "profile_1", ...input.basicInfo! },
    educationItems: input.educationItems.map((item, index) => ({ id: `edu_${index}`, profileId: "profile_1", ...item })),
    skillItems: input.skillItems.map((item, index) => ({ id: `skill_${index}`, profileId: "profile_1", ...item })),
    projectItems: input.projectItems.map((item, index) => ({ id: `project_${index}`, profileId: "profile_1", ...item })),
    experienceItems: input.experienceItems.map((item, index) => ({ id: `exp_${index}`, profileId: "profile_1", ...item })),
    certificateItems: input.certificateItems.map((item, index) => ({ id: `cert_${index}`, profileId: "profile_1", ...item })),
    awardItems: input.awardItems.map((item, index) => ({ id: `award_${index}`, profileId: "profile_1", ...item })),
    evidenceItems: input.evidenceItems.map((item, index) => ({ id: `ev_${index}`, profileId: "profile_1", ...item })),
    ...overrides,
  } as ResumeProfile;
}

describe("resume generator", () => {
  it("generates a general resume from the mock profile", () => {
    const result = generateResumeFromProfile(profile());

    expect(result.contentMarkdown).toContain("## 基本信息");
    expect(result.contentMarkdown).toContain("## 教育经历");
    expect(result.contentMarkdown).toContain("## 专业技能");
    expect(result.contentMarkdown).toContain("## 项目经历");
    expect(result.contentMarkdown).toContain("## 实习/工作经历");
    expect(result.targetRole).toBe("Java 后端开发");
  });

  it("does not fabricate metrics when project metrics are empty", () => {
    const sample = profile().projectItems[1];
    const bullets = optimizeProjectBullets({ ...sample, metrics: [] });

    expect(bullets.join("\n")).not.toContain("量化结果");
    expect(bullets.join("\n")).not.toContain("100");
  });

  it("detects missing fields", () => {
    const sparse = profile({
      basicInfo: null,
      targetRoles: [],
      targetCities: [],
      educationItems: [],
      skillItems: [],
      projectItems: [],
      evidenceItems: [],
    });

    expect(detectResumeMissingFields(sparse)).toEqual(
      expect.arrayContaining(["基本联系方式不完整", "求职目标不明确", "缺少教育经历", "缺少项目经历"]),
    );
  });

  it("calculates a score between 0 and 100", () => {
    const generated = generateResumeFromProfile(profile());
    const score = calculateResumeQualityScore({ ...generated, profile: profile() });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("omits empty optional sections instead of emitting empty headings", () => {
    const generated = generateResumeFromProfile(profile({
      educationItems: [],
      projectItems: [],
      experienceItems: [],
      certificateItems: [],
      awardItems: [],
      evidenceItems: [],
    }));

    expect(generated.contentMarkdown).not.toContain("## 教育经历");
    expect(generated.contentMarkdown).not.toContain("## 项目经历");
    expect(generated.contentMarkdown).not.toContain("## 证书与获奖");
    expect(generated.contentMarkdown).not.toMatch(/^##\s*$/m);
  });
});
