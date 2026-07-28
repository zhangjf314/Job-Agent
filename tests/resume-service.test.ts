/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { createMockGraduateProfile } from "@/services/mock-profile";
import { duplicateResume, generateGeneralResumeFromProfile, setDefaultResume } from "@/services/resume-service";

type Row = Record<string, any>;

class ResumeMockDb {
  resumes: Row[] = [];
  sections: Row[] = [];
  seq = 0;
  profile: Row;

  constructor() {
    const input = createMockGraduateProfile("user_1");
    this.profile = {
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
    };
  }

  next(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  include(resume: Row) {
    return {
      ...resume,
      sections: this.sections.filter((section) => section.resumeId === resume.id).sort((a, b) => a.order - b.order),
      profile: this.profile,
    };
  }

  careerProfile = {
    findUniqueOrThrow: async () => this.profile,
  };

  resume = {
    count: async ({ where }: Row) => this.resumes.filter((resume) => resume.profileId === where.profileId).length,
    create: async ({ data }: Row) => {
      const id = this.next("resume");
      const resume = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
      delete resume.sections;
      this.resumes.push(resume);
      this.sections.push(
        ...data.sections.create.map((section: Row) => ({
          id: this.next("section"),
          resumeId: id,
          ...section,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
      return this.include(resume);
    },
    findUniqueOrThrow: async ({ where }: Row) => {
      const resume = this.resumes.find((item) => item.id === where.id);
      if (!resume) throw new Error("Resume not found");
      return this.include(resume);
    },
    updateMany: async ({ where, data }: Row) => {
      this.resumes
        .filter((resume) => resume.profileId === where.profileId && (!where.NOT || resume.id !== where.NOT.id))
        .forEach((resume) => Object.assign(resume, data));
      return { count: 1 };
    },
    update: async ({ where, data }: Row) => {
      const resume = this.resumes.find((item) => item.id === where.id);
      if (!resume) throw new Error("Resume not found");
      Object.assign(resume, data, { updatedAt: new Date() });
      return this.include(resume);
    },
  };
}

describe("resume service", () => {
  it("generates a general resume from a mock profile", async () => {
    const db = new ResumeMockDb() as any;
    const resume = (await generateGeneralResumeFromProfile("profile_1", db)) as any;

    expect(resume.contentMarkdown).toContain("## 基本信息");
    expect(resume.contentMarkdown).toContain("## 项目经历");
    expect(resume.sections.length).toBeGreaterThan(0);
    expect(resume.isDefault).toBe(true);
  });

  it("duplicates a resume as a new version", async () => {
    const db = new ResumeMockDb() as any;
    const resume = await generateGeneralResumeFromProfile("profile_1", db);
    const copied = await duplicateResume(resume.id, db);

    expect(copied.id).not.toBe(resume.id);
    expect(copied.title).toContain("副本");
    expect(copied.contentMarkdown).toBe(resume.contentMarkdown);
  });

  it("keeps only one default resume per profile", async () => {
    const db = new ResumeMockDb() as any;
    const first = await generateGeneralResumeFromProfile("profile_1", db);
    const second = await duplicateResume(first.id, db);
    await setDefaultResume(second.id, db);

    const defaults = db.resumes.filter((resume: Row) => resume.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.id);
  });
});
