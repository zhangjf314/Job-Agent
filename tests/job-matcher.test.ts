import { describe, expect, it } from "vitest";
import { createMockGraduateProfile } from "@/services/mock-profile";
import type { ResumeProfile } from "@/services/resume-generator";
import { normalizeJobPost } from "@/services/jobs/job-normalizer";
import { calculateJobMatch } from "@/services/jobs/job-matcher";

function profileWithoutRedis(): ResumeProfile {
  const input = createMockGraduateProfile("u1");
  return {
    id: "p1", userId: "u1", targetStatus: input.targetStatus, targetRoles: input.targetRoles, targetCities: input.targetCities,
    expectedSalaryMin: input.expectedSalaryMin, expectedSalaryMax: input.expectedSalaryMax, personalSummary: input.personalSummary,
    profileCompletenessScore: 100, createdAt: new Date(), updatedAt: new Date(),
    basicInfo: { id: "b1", profileId: "p1", ...input.basicInfo! },
    educationItems: input.educationItems.map((x, i) => ({ id: `e${i}`, profileId: "p1", ...x })),
    skillItems: input.skillItems.filter((s) => s.name !== "Redis").map((x, i) => ({ id: `s${i}`, profileId: "p1", ...x })),
    projectItems: input.projectItems.map((x, i) => ({ id: `p${i}`, profileId: "p1", ...x, techStack: x.techStack.filter((s) => s !== "Redis"), highlights: x.highlights.filter((h) => !h.includes("Redis")) })),
    experienceItems: input.experienceItems.map((x, i) => ({ id: `x${i}`, profileId: "p1", ...x, techStack: x.techStack.filter((s) => s !== "Redis") })),
    certificateItems: [], awardItems: [], evidenceItems: [],
  } as ResumeProfile;
}

describe("calculateJobMatch", () => {
  it("scores 0-100 and puts missing Redis in gaps only", async () => {
    const job = await normalizeJobPost({ rawText: "Java 后端，杭州，本科，要求 Java、Spring Boot、MySQL、Redis。", source: "manual" });
    const match = calculateJobMatch(profileWithoutRedis(), null, null, null, job as never);
    expect(match.matchScore).toBeGreaterThanOrEqual(0);
    expect(match.matchScore).toBeLessThanOrEqual(100);
    expect(match.gaps.join("\n")).toContain("Redis");
    expect(match.matchedPoints.join("\n")).not.toContain("Redis");
  });

  it("high risk job is not strong_yes", async () => {
    const job = await normalizeJobPost({ rawText: "高薪转行 Java，先缴费，收费培训，培训贷，包就业。", source: "manual" });
    const match = calculateJobMatch(profileWithoutRedis(), null, null, null, job as never);
    expect(["no", "maybe"]).toContain(match.recommendation);
  });
});
