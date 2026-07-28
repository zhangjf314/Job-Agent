/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { createMockGraduateProfile } from "@/services/mock-profile";
import { generateTailoredResume } from "@/services/jd-service";

type Row = Record<string, any>;

class JDMockDb {
  seq = 0;
  resumes: Row[] = [];
  sections: Row[] = [];
  jdAnalyses: Row[] = [];
  tailoredResumes: Row[] = [];
  jobDescriptionRow: Row;
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
    this.resumes.push({
      id: "resume_1",
      profileId: "profile_1",
      title: "通用简历",
      targetRole: "Java 后端开发",
      targetCity: "杭州",
      language: "zh_CN",
      type: "general",
      status: "draft",
      contentMarkdown: "## 教育经历\n南京邮电大学\n## 项目经历\n校园二手交易平台 Spring Boot MySQL Redis",
      contentJson: null,
      sourceProfileSnapshot: null,
      sourceProfileVersion: "",
      completenessScore: 100,
      qualityScore: 80,
      missingFields: [],
      improvementQuestions: [],
      qualityWarnings: [],
      generationNotes: [],
      changeLog: "",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.jobDescriptionRow = {
      id: "jd_1",
      profileId: "profile_1",
      resumeId: "resume_1",
      title: "Java 后端开发",
      company: "测试公司",
      city: "杭州",
      rawText: "Java 后端开发应届生，本科，要求 Java、Spring Boot、MySQL、Redis，负责接口开发。",
      sourceUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  next(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  includeResume(resume: Row) {
    return { ...resume, sections: this.sections.filter((section) => section.resumeId === resume.id), profile: this.profile };
  }

  careerProfile = { findUniqueOrThrow: async () => this.profile };
  jobDescription = { findUniqueOrThrow: async () => this.jobDescriptionRow };
  resume = {
    findUniqueOrThrow: async ({ where }: Row) => this.includeResume(this.resumes.find((resume) => resume.id === where.id)!),
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }: Row) => {
      const id = this.next("resume");
      const resume = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
      delete resume.sections;
      this.resumes.push(resume);
      this.sections.push(...data.sections.create.map((section: Row) => ({ id: this.next("section"), resumeId: id, ...section })));
      return this.includeResume(resume);
    },
  };
  jDAnalysis = {
    create: async ({ data }: Row) => {
      const analysis = { id: this.next("analysis"), ...data, createdAt: new Date(), updatedAt: new Date() };
      this.jdAnalyses.push(analysis);
      return analysis;
    },
    findUnique: async ({ where }: Row) => this.jdAnalyses.find((analysis) => analysis.id === where.id) ?? null,
  };
  tailoredResume = {
    create: async ({ data }: Row) => {
      const row = { id: this.next("tailored"), ...data, jdAnalysis: this.jdAnalyses[0], baseResume: this.resumes[0], tailoredResume: this.resumes.find((resume) => resume.id === data.tailoredResumeId), createdAt: new Date(), updatedAt: new Date() };
      this.tailoredResumes.push(row);
      return row;
    },
  };
}

describe("jd service", () => {
  it("creates a jd_tailored resume and keeps real project and education facts", async () => {
    const db = new JDMockDb() as any;
    const result = await generateTailoredResume("profile_1", "resume_1", "jd_1", db);

    expect(result.resume.type).toBe("jd_tailored");
    expect(result.resume.contentMarkdown).toContain("校园二手交易平台");
    expect(result.resume.contentMarkdown).toContain("南京邮电大学");
    expect(result.rewriteExplanation.join("\n")).toContain("技能前置");
  });
});
