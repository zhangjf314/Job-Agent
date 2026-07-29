import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeJDText } from "@/services/jd-analyzer";
import { createMockGraduateProfile } from "@/services/mock-profile";
import {
  TailoredResumeFactualityError,
  type FactualityReport,
} from "@/services/ai/tailored-resume-factuality";
import { LLMClientError } from "@/services/ai/llm-client";

const providerMocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/services/ai/provider-factory", () => ({
  createJDAnalyzerProvider: () => ({ analyze: providerMocks.analyze }),
  createTailoredResumeWriterProvider: () => ({ write: providerMocks.write }),
}));

import { generateTailoredResume } from "@/services/jd-service";

function profile() {
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
    evidenceItems: input.evidenceItems.map((item, index) => ({ id: `evidence_${index}`, profileId: "profile_1", ...item })),
  };
}

function report(): FactualityReport {
  return {
    status: "fail",
    violations: [{
      category: "INVENTED_LLM_EXPERIENCE",
      path: "sections.0.lines.0",
      safeSummary: "Unsupported LLM experience.",
      severity: "fail",
    }],
    groundedClaimCount: 0,
    ungroundedClaimCount: 1,
    unknownFactIds: 0,
    missingSourceIds: 0,
  };
}

describe("JD service factuality save gate", () => {
  beforeEach(() => {
    providerMocks.analyze.mockReset();
    providerMocks.write.mockReset();
  });

  it("does not create a resume or tailored-resume row after factuality failure", async () => {
    const resumeCreate = vi.fn();
    const tailoredCreate = vi.fn();
    const analysisCreate = vi.fn(async ({ data }) => ({ id: "analysis_1", ...data }));
    const db = {
      careerProfile: { findUniqueOrThrow: vi.fn(async () => profile()) },
      resume: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "resume_1",
          profileId: "profile_1",
          title: "Base resume",
          targetCity: "",
          templateKey: "classic",
          contentMarkdown: "Java Spring Boot MySQL",
          sections: [],
          profile: profile(),
        })),
        updateMany: vi.fn(),
        create: resumeCreate,
      },
      jobDescription: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "jd_1",
          profileId: "profile_1",
          title: "Java developer",
          city: "",
          rawText: "Java Spring Boot MySQL internship",
        })),
      },
      jDAnalysis: { create: analysisCreate },
      tailoredResume: { create: tailoredCreate },
    };
    providerMocks.analyze.mockResolvedValue(analyzeJDText("Java Spring Boot MySQL internship"));
    providerMocks.write.mockRejectedValue(new TailoredResumeFactualityError(report()));

    await expect(generateTailoredResume(
      "profile_1",
      "resume_1",
      "jd_1",
      db as never,
    )).rejects.toMatchObject({ code: "TAILORED_RESUME_FACTUALITY_VIOLATION" });

    expect(analysisCreate).toHaveBeenCalledTimes(1);
    expect(resumeCreate).not.toHaveBeenCalled();
    expect(tailoredCreate).not.toHaveBeenCalled();
  });

  it("does not save after a rewriteExplanation schema failure", async () => {
    const resumeCreate = vi.fn();
    const tailoredCreate = vi.fn();
    const db = {
      careerProfile: { findUniqueOrThrow: vi.fn(async () => profile()) },
      resume: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "resume_1",
          profileId: "profile_1",
          title: "Base resume",
          targetCity: "",
          templateKey: "classic",
          contentMarkdown: "Java Spring Boot MySQL",
          sections: [],
          profile: profile(),
        })),
        updateMany: vi.fn(),
        create: resumeCreate,
      },
      jobDescription: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "jd_1",
          profileId: "profile_1",
          title: "Java developer",
          city: "",
          rawText: "Java Spring Boot MySQL internship",
        })),
      },
      jDAnalysis: {
        create: vi.fn(async ({ data }) => ({ id: "analysis_1", ...data })),
      },
      tailoredResume: { create: tailoredCreate },
    };
    providerMocks.analyze.mockResolvedValue(
      analyzeJDText("Java Spring Boot MySQL internship"),
    );
    providerMocks.write.mockRejectedValue(
      new LLMClientError(
        "LLM_SCHEMA_VALIDATION_FAILED",
        "LLM structured output does not match the required schema.",
      ),
    );

    await expect(generateTailoredResume(
      "profile_1",
      "resume_1",
      "jd_1",
      db as never,
    )).rejects.toMatchObject({ code: "LLM_SCHEMA_VALIDATION_FAILED" });
    expect(resumeCreate).not.toHaveBeenCalled();
    expect(tailoredCreate).not.toHaveBeenCalled();
  });
});
