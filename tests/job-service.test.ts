/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { createJDFromJobPost, createManualRawJob, saveJob, searchJobsForProfile, updateSavedJobStatus } from "@/services/jobs/job-service";
import { MockChinaJobAdapter } from "@/services/jobs/mock-china-job-adapter";
import { createMockGraduateProfile } from "@/services/mock-profile";

describe("job service helpers", () => {
  it("mock adapter returns mainland jobs", async () => {
    const jobs = await new MockChinaJobAdapter().search({ query: "Java", city: "杭州" });
    expect(jobs.length).toBeGreaterThan(0);
  });

  it("createManualRawJob structures pasted text", async () => {
    const job = await createManualRawJob({ rawText: "岗位：Java 后端\n公司：测试公司\n城市：杭州\n15k-25k\n本科 Java Spring Boot MySQL", source: "manual" });
    expect(job.city).toBe("杭州");
    expect(job.skills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL"]));
  });

  it("saveJob and updateSavedJobStatus work with db adapter", async () => {
    const db = {
      savedJob: {
        upsert: async ({ create }: any) => ({ id: "saved_1", ...create, jobPost: { id: create.jobPostId } }),
        update: async ({ where, data }: any) => ({ id: where.id, ...data, jobPost: { id: "job_1" } }),
      },
    } as any;
    const saved = await saveJob("p1", "j1", "", db);
    expect(saved.status).toBe("saved");
    const updated = await updateSavedJobStatus("saved_1", "applied", db);
    expect(updated.status).toBe("applied");
  });

  it("searchJobsForProfile saves mock jobs and creates matches", async () => {
    const input = createMockGraduateProfile("u1");
    const profile = {
      id: "p1",
      userId: "u1",
      targetStatus: input.targetStatus,
      targetRoles: input.targetRoles,
      targetCities: input.targetCities,
      expectedSalaryMin: input.expectedSalaryMin,
      expectedSalaryMax: input.expectedSalaryMax,
      personalSummary: input.personalSummary,
      profileCompletenessScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      basicInfo: { id: "b1", profileId: "p1", ...input.basicInfo! },
      educationItems: input.educationItems.map((x, i) => ({ id: `e${i}`, profileId: "p1", ...x })),
      skillItems: input.skillItems.map((x, i) => ({ id: `s${i}`, profileId: "p1", ...x })),
      projectItems: input.projectItems.map((x, i) => ({ id: `p${i}`, profileId: "p1", ...x })),
      experienceItems: input.experienceItems.map((x, i) => ({ id: `x${i}`, profileId: "p1", ...x })),
      certificateItems: [],
      awardItems: [],
      evidenceItems: [],
    };
    const jobs: any[] = [];
    const matches: any[] = [];
    const db = {
      jobSearchRun: {
        create: async ({ data }: any) => ({ id: "run_1", ...data }),
        update: async ({ data }: any) => ({ id: "run_1", ...data }),
      },
      jobPost: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          const row = { id: `job_${jobs.length + 1}`, ...data };
          jobs.push(row);
          return row;
        },
        findUniqueOrThrow: async ({ where }: any) => jobs.find((job) => job.id === where.id),
      },
      careerProfile: { findUniqueOrThrow: async () => profile },
      resume: { findFirst: async () => null },
      jobMatch: {
        create: async ({ data }: any) => {
          const row = { id: `match_${matches.length + 1}`, ...data };
          matches.push(row);
          return row;
        },
      },
    } as any;
    const result = await searchJobsForProfile({ profileId: "p1", query: "Java", city: "杭州" }, db);
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("createJDFromJobPost converts a job post to JobDescription", async () => {
    const db = {
      jobPost: {
        findUniqueOrThrow: async () => ({
          id: "job_1",
          title: "Java 后端",
          normalizedTitle: "Java 后端开发",
          company: "测试公司",
          city: "杭州",
          salaryText: "15k-25k",
          description: "负责后端开发",
          requirements: "本科 Java Spring Boot MySQL",
          skills: ["Java", "Spring Boot", "MySQL"],
          sourceUrl: "https://example.com/job",
        }),
      },
      jobDescription: {
        create: async ({ data }: any) => ({ id: "jd_1", ...data }),
      },
    } as any;
    const jd = await createJDFromJobPost("p1", "job_1", undefined, db);
    expect(jd.rawText).toContain("Java");
    expect(jd.title).toBe("Java 后端开发");
  });
});
