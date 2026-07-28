import { describe, expect, it } from "vitest";
import { calculateProfileCompleteness } from "@/services/profile-completeness";
import type { CareerProfileWithItems } from "@/types/career-profile";

function profile(overrides: Partial<CareerProfileWithItems> = {}): CareerProfileWithItems {
  return {
    id: "profile_1",
    userId: "user_1",
    targetStatus: "seeking_fulltime",
    targetRoles: ["Java 后端开发"],
    targetCities: ["杭州"],
    expectedSalaryMin: 12000,
    expectedSalaryMax: 18000,
    personalSummary: null,
    profileCompletenessScore: 0,
    basicInfo: {
      id: "basic_1",
      realName: "李明",
      phone: "13800138000",
      email: "liming@example.com",
      location: "南京",
      githubUrl: "https://github.com/example",
      portfolioUrl: null,
      linkedinUrl: null,
      personalWebsite: null,
    },
    educationItems: [{ id: "edu_1" }],
    skillItems: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
    projectItems: [{ id: "p1" }],
    experienceItems: [{ id: "e1" }],
    certificateItems: [],
    awardItems: [],
    evidenceItems: [],
    ...overrides,
  };
}

describe("calculateProfileCompleteness", () => {
  it("returns 100 for a complete profile with supplemental material", () => {
    expect(calculateProfileCompleteness(profile())).toBe(100);
  });

  it("scores missing sections according to the initial rule", () => {
    expect(
      calculateProfileCompleteness(
        profile({
          basicInfo: null,
          skillItems: [{ id: "s1" }, { id: "s2" }],
          projectItems: [],
        }),
      ),
    ).toBe(40);
  });
});
