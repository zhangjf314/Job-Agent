/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { importSearchResultsJson, searchRealJobsForProfile } from "@/services/jobs/job-service";
import { createMockGraduateProfile } from "@/services/mock-profile";

function mockDb() {
  const input = createMockGraduateProfile("u1");
  const profile = {
    id: "p1", userId: "u1", targetStatus: input.targetStatus, targetRoles: input.targetRoles, targetCities: input.targetCities,
    expectedSalaryMin: input.expectedSalaryMin, expectedSalaryMax: input.expectedSalaryMax, personalSummary: input.personalSummary,
    profileCompletenessScore: 100, createdAt: new Date(), updatedAt: new Date(),
    basicInfo: { id: "b1", profileId: "p1", ...input.basicInfo! },
    educationItems: input.educationItems.map((x, i) => ({ id: `e${i}`, profileId: "p1", ...x })),
    skillItems: input.skillItems.map((x, i) => ({ id: `s${i}`, profileId: "p1", ...x })),
    projectItems: input.projectItems.map((x, i) => ({ id: `p${i}`, profileId: "p1", ...x })),
    experienceItems: input.experienceItems.map((x, i) => ({ id: `x${i}`, profileId: "p1", ...x })),
    certificateItems: [], awardItems: [], evidenceItems: [],
  };
  const jobs: any[] = [];
  const matches: any[] = [];
  return {
    jobSearchRun: { create: async ({ data }: any) => ({ id: "run_1", ...data }), update: async ({ data }: any) => ({ id: "run_1", ...data }) },
    jobPost: {
      findFirst: async () => null,
      create: async ({ data }: any) => { const row = { id: `job_${jobs.length + 1}`, ...data }; jobs.push(row); return row; },
      findUniqueOrThrow: async ({ where }: any) => jobs.find((job) => job.id === where.id),
    },
    careerProfile: { findUniqueOrThrow: async () => profile },
    resume: { findFirst: async () => null },
    jobMatch: { create: async ({ data }: any) => { const row = { id: `match_${matches.length + 1}`, ...data }; matches.push(row); return row; } },
  } as any;
}

describe("real search fixture pipeline", () => {
  it("searchRealJobsForProfile uses fixture provider and creates matches", async () => {
    const result = await searchRealJobsForProfile({ profileId: "p1", query: "Java 后端", city: "杭州" }, mockDb());
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("imports search results JSON", async () => {
    const json = JSON.stringify([{ title: "杭州 Java 后端", url: "https://careers.example/1", snippet: "本科 Java Spring Boot MySQL Redis 15k-25k" }]);
    const result = await importSearchResultsJson("p1", json, mockDb());
    expect(result.jobs[0].title).toContain("Java");
  });
});
