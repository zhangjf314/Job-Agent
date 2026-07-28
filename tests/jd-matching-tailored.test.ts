import { describe, expect, it } from "vitest";
import { analyzeJDText } from "@/services/jd-analyzer";
import { calculateJDMatch } from "@/services/jd-matching";
import { createMockGraduateProfile } from "@/services/mock-profile";
import type { ResumeProfile } from "@/services/resume-generator";
import { generateTailoredResumeContent } from "@/services/tailored-resume-generator";

function profileWithoutRedis(): ResumeProfile {
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
    skillItems: input.skillItems.filter((skill) => skill.name !== "Redis").map((item, index) => ({ id: `skill_${index}`, profileId: "profile_1", ...item })),
    projectItems: input.projectItems.map((item, index) => ({
      id: `project_${index}`,
      profileId: "profile_1",
      ...item,
      techStack: item.techStack.filter((skill) => skill !== "Redis"),
      highlights: item.highlights.filter((highlight) => !highlight.includes("Redis")),
    })),
    experienceItems: input.experienceItems.map((item, index) => ({ id: `exp_${index}`, profileId: "profile_1", ...item, techStack: item.techStack.filter((skill) => skill !== "Redis") })),
    certificateItems: input.certificateItems.map((item, index) => ({ id: `cert_${index}`, profileId: "profile_1", ...item })),
    awardItems: input.awardItems.map((item, index) => ({ id: `award_${index}`, profileId: "profile_1", ...item })),
    evidenceItems: input.evidenceItems.map((item, index) => ({ id: `ev_${index}`, profileId: "profile_1", ...item })),
  } as ResumeProfile;
}

const jdText = "招聘 Java 后端开发应届生，本科及以上，要求 Java、Spring Boot、MySQL、Redis，负责后端接口开发和数据库优化。";

describe("JD matching and tailored resume", () => {
  it("puts Redis in gaps and does not claim Redis in tailored resume body when profile lacks it", () => {
    const profile = profileWithoutRedis();
    const jd = analyzeJDText(jdText);
    const matched = calculateJDMatch(profile, { contentMarkdown: "Java Spring Boot MySQL 校园二手交易平台" }, jd);
    const tailored = generateTailoredResumeContent(profile, { contentMarkdown: "## 专业技能" }, matched);

    expect(matched.gaps.join("\n")).toContain("Redis");
    expect(tailored.contentMarkdown).not.toContain("Redis");
    expect(tailored.applicationMaterials.selfIntroduction).toContain("Java 后端");
    expect(tailored.applicationMaterials.applicationEmail).toContain("主题：应聘");
    expect(tailored.applicationMaterials.recruiterMessage).not.toContain("掌握Redis");
  });

  it("matches Spring Boot and MySQL project evidence", () => {
    const profile = profileWithoutRedis();
    const jd = analyzeJDText(jdText);
    const matched = calculateJDMatch(profile, { contentMarkdown: "Java Spring Boot MySQL" }, jd);

    expect(matched.matchedPoints.join("\n")).toContain("Spring Boot");
    expect(matched.matchedPoints.join("\n")).toContain("MySQL");
    expect(matched.scoreBreakdown.projectMatchScore).toBeGreaterThan(0);
    expect(matched.matchScore).toBeGreaterThanOrEqual(0);
    expect(matched.matchScore).toBeLessThanOrEqual(100);
  });
});
