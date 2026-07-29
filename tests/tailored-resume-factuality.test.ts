import { describe, expect, it, vi } from "vitest";
import type { ResumeProfile } from "@/services/resume-generator";
import type { JDAnalysisResult } from "@/types/jd";
import {
  buildCandidateFactRegistry,
  buildJobRequirementFacts,
} from "@/services/ai/candidate-fact-registry";
import {
  groundedTailoredResumeOutputContract,
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
  type GroundedTailoredResume,
  type GroundedText,
} from "@/services/ai/tailored-resume-grounding";
import {
  evaluateGroundedClaim,
  evaluateTailoredResumeFactuality,
  TailoredResumeFactualityError,
} from "@/services/ai/tailored-resume-factuality";
import {
  buildGroundedTailoredResumeMessages,
  LLMTailoredResumeWriterProvider,
  MockTailoredResumeWriterProvider,
} from "@/services/ai/tailored-resume-writer";
import type { LLMClient, LLMCompletionMetadata } from "@/services/ai/llm-client";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

function profile(): ResumeProfile {
  return {
    basicInfo: {
      realName: "演示候选人",
      email: "demo@example.invalid",
      phone: "",
      location: "",
      githubUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
      personalWebsite: null,
    },
    educationItems: [{
      school: "",
      major: "信息与计算科学",
      degree: "本科",
      startDate: null,
      endDate: null,
      gpa: null,
      ranking: null,
      courses: [],
      honors: [],
    }],
    skillItems: [
      { name: "TypeScript", level: "基础", evidence: "" },
      { name: "typescript", level: "基础", evidence: "" },
      { name: "Python", level: "基础", evidence: "" },
      { name: "", level: "", evidence: "" },
    ],
    projectItems: [{
      name: "课程任务管理系统",
      role: "",
      background: "",
      goal: "",
      responsibilities: [
        "实现任务创建、编辑、筛选和状态管理",
        "使用 Zod 进行输入校验",
        "编写基础单元测试",
      ],
      techStack: ["Next.js", "PostgreSQL"],
      highlights: [],
      results: null,
      metrics: ["支持 20 条课程测试数据"],
      links: [],
      startDate: null,
      endDate: null,
    }],
    experienceItems: [],
    certificateItems: [],
    awardItems: [],
    evidenceItems: [],
    targetRoles: ["AI 应用开发实习生"],
    targetCities: [],
  } as unknown as ResumeProfile;
}

function jd(): JDAnalysisResult {
  return {
    targetRole: "AI 应用开发实习生",
    seniorityLevel: "intern",
    internshipDuration: "",
    conversionOpportunity: "",
    candidateProfile: [],
    coreResponsibilities: ["使用 TypeScript 或 Python 开发 AI 应用", "对接 OpenAI-compatible LLM API"],
    hardSkills: ["TypeScript", "Python", "OpenAI-compatible LLM API"],
    softSkills: [],
    experienceRequirements: ["AI 应用开发经验"],
    educationRequirements: [],
    bonusPoints: [],
    keywords: ["LLM API"],
    matchScore: 60,
    scoreBreakdown: {
      hardSkillScore: 60,
      projectMatchScore: 50,
      experienceMatchScore: 20,
      educationMatchScore: 80,
      keywordCoverageScore: 50,
    },
    matchedPoints: ["TypeScript", "Python"],
    gaps: ["OpenAI-compatible LLM API 接入经验", "LLM 项目实践", "AI 应用开发经验"],
    riskWarnings: [],
    resumeRewriteSuggestions: [],
  };
}

function factId(facts: ReturnType<typeof buildCandidateFactRegistry>, text: string) {
  const id = facts.find((fact) => fact.text.includes(text))?.id;
  if (!id) throw new Error(`Missing test fact: ${text}`);
  return id;
}

function grounded(
  claim: GroundedText,
): GroundedTailoredResume {
  return groundedTailoredResumeSchema.parse({
    sections: [
      { type: "summary", title: "个人概况", lines: [claim], order: 0 },
      { type: "skills", title: "技能", lines: [], order: 1 },
      { type: "projects", title: "项目", lines: [], order: 2 },
      { type: "experiences", title: "经历", lines: [], order: 3 },
      { type: "education", title: "教育经历", lines: [], order: 4 },
      { type: "others", title: "其他", lines: [], order: 5 },
    ],
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [{ text: "求职目标为 AI 应用开发实习生", sourceFactIds: [], kind: "goal" }],
      applicationEmail: [{ text: "希望应聘 AI 应用开发实习生", sourceFactIds: [], kind: "goal" }],
      recruiterMessage: [{ text: "计划继续学习 LLM API 接入", sourceFactIds: [], kind: "goal" }],
    },
  });
}

function metadata(): LLMCompletionMetadata {
  return {
    requestId: "logical",
    model: "test-model",
    latencyMs: 10,
    retryCount: 0,
    repairCount: 0,
    finalizationRetryCount: 0,
    externalRequestCount: 1,
    reasoningFieldPresent: false,
    thinkingModeRequested: "provider_default",
    groundedNormalizationSummary: {
      groundedNormalizationApplied: false,
      defaultedApplicationMaterialArrays: [],
      canonicalizedSectionTypes: 0,
      canonicalizedSectionOrders: 0,
      deduplicatedFactIdCount: 0,
      rewriteExplanationCount: 0,
      rewriteExplanationLimit: 2,
      rewriteExplanationReceivedType: "array",
      changedSectionsCount: 0,
      maximumSourceFactIdsObserved: 1,
      changedSectionsLimit: 2,
      sourceFactIdLimit: 8,
      sectionCount: 6,
      sectionLinesLimit: 2,
      sectionLineCounts: [1, 0, 0, 0, 0, 0],
      maximumSectionLinesObserved: 1,
      sectionLineCardinalityViolationCount: 0,
      sectionLineCardinalityViolationPaths: [],
      skillsSectionLineCount: 0,
    },
    responseSafetySummary: {
      responseId: "provider",
      choiceCount: 1,
      firstChoicePresent: true,
      messagePresent: true,
      contentState: "present",
      contentCharacterLength: 2,
      contentByteLength: 2,
      finishReason: "stop",
      reasoningFieldPresent: false,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      outputLimitReached: null,
    },
  };
}

describe("candidate fact registry", () => {
  it("compacts the grounded prompt without duplicating evidence, requirements, or contract", () => {
    const facts = buildCandidateFactRegistry(
      fictionalSmokeProfile,
      fictionalSmokeBaseResume,
    );
    const requirements = buildJobRequirementFacts(fictionalSmokeJD, facts);
    const messages = buildGroundedTailoredResumeMessages(facts, requirements);
    const prompt = messages.map((message) => message.content).join("\n");
    const compactCharacterCount = messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    expect(compactCharacterCount).toBe(1252);
    expect(2335 - compactCharacterCount).toBe(1083);
    expect(prompt.match(/^CANDIDATE_FACTS$/gm)).toHaveLength(1);
    expect(prompt.match(/^JOB_REQUIREMENTS_ONLY$/gm)).toHaveLength(1);
    expect(prompt).not.toContain("OUTPUT_CONTRACT");
    expect(prompt).not.toContain("FORBIDDEN_UNSUPPORTED_CLAIMS");
    expect(prompt).toContain("never candidate evidence");
    expect(prompt).toContain("Never invent employers");
    expect(groundedTailoredResumeOutputContract).toContain(
      "fixed order summary,skills,projects,experiences,education,others",
    );
    expect(groundedTailoredResumeOutputContract).toContain(
      "sourceFactIds:0..8 unique supplied F_*",
    );
    expect(groundedTailoredResumeOutputContract).toContain(
      "applicationMaterials require",
    );
  });

  it("generates stable IDs, normalizes empty values, and deduplicates skills", () => {
    const first = buildCandidateFactRegistry(profile(), "TypeScript 课程任务管理系统");
    const second = buildCandidateFactRegistry(profile(), "TypeScript 课程任务管理系统");
    expect(first).toEqual(second);
    expect(first.filter((fact) => fact.category === "skill" && /typescript/i.test(fact.text))).toHaveLength(1);
    expect(first.every((fact) => fact.text.trim().length > 0)).toBe(true);
    expect(first.map((fact) => fact.id).join(" ")).not.toContain("演示候选人");
    expect(first.map((fact) => fact.id).join(" ")).not.toContain("demo@example.invalid");
  });

  it("classifies projects, technologies, responsibilities, and metrics separately", () => {
    const facts = buildCandidateFactRegistry(profile());
    expect(facts.some((fact) => fact.category === "project" && fact.text.includes("课程任务管理系统"))).toBe(true);
    expect(facts.some((fact) => fact.category === "project_technology" && fact.text.includes("Next.js"))).toBe(true);
    expect(facts.some((fact) => fact.category === "project_responsibility" && fact.text.includes("Zod"))).toBe(true);
    expect(facts.some((fact) => fact.category === "metric" && fact.text.includes("20"))).toBe(true);
  });

  it("keeps JD-only AI and LLM requirements outside candidate facts", () => {
    const facts = buildCandidateFactRegistry(profile());
    const requirements = buildJobRequirementFacts(jd(), facts);
    expect(facts.some((fact) => /LLM|OpenAI|AI 应用开发经验/i.test(fact.text))).toBe(false);
    expect(requirements.map((item) => item.text).join(" ")).toMatch(/LLM|OpenAI/);
    expect(requirements.every((item) => item.id.startsWith("J_REQ_"))).toBe(true);
  });
});

describe("deterministic tailored-resume factuality", () => {
  it.each([
    ["使用 Next.js 和 PostgreSQL 开发课程任务管理系统", "Next.js"],
    ["实现任务创建、编辑、筛选和状态管理", "任务创建"],
    ["使用 Zod 进行输入校验", "Zod"],
    ["编写基础单元测试", "基础单元测试"],
    ["具备 TypeScript 基础", "TypeScript"],
  ])("passes supported rewrite: %s", (text, sourceText) => {
    const facts = buildCandidateFactRegistry(profile());
    const claim = { text, sourceFactIds: [factId(facts, sourceText)], kind: "fact" as const };
    expect(evaluateGroundedClaim("claim", claim, facts, buildJobRequirementFacts(jd(), facts))).toEqual([]);
  });

  it.each([
    ["开发过 AI 应用项目", "INVENTED_AI_PROJECT"],
    ["完成 OpenAI-compatible LLM API 接入", "INVENTED_LLM_EXPERIENCE"],
    ["具备大模型应用实战经验", "INVENTED_LLM_EXPERIENCE"],
    ["主导企业级 AI 项目", "INVENTED_AI_PROJECT"],
    ["将接口性能提升 40%", "INVENTED_METRIC"],
    ["拥有某公司实习经历", "INVENTED_INTERNSHIP"],
    ["获得某项竞赛奖项", "INVENTED_AWARD"],
  ])("fails unsupported claim: %s", (text, category) => {
    const facts = buildCandidateFactRegistry(profile());
    const claim = {
      text,
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact" as const,
    };
    const categories = evaluateGroundedClaim(
      "claim",
      claim,
      facts,
      buildJobRequirementFacts(jd(), facts),
    ).map((item) => item.category);
    expect(categories).toContain(category);
  });

  it.each([
    "求职目标为 AI 应用开发",
    "计划学习 LLM API 接入",
    "现有 Web 开发基础可迁移到 AI 应用学习",
  ])("does not fail explicit goal language: %s", (text) => {
    const facts = buildCandidateFactRegistry(profile());
    const violations = evaluateGroundedClaim(
      "claim",
      { text, sourceFactIds: [], kind: "goal" },
      facts,
      buildJobRequirementFacts(jd(), facts),
    );
    expect(violations.some((item) => item.severity === "fail")).toBe(false);
  });

  it.each([
    ["精通自动化测试", "基础单元测试"],
    ["拥有丰富生产经验", "课程任务管理系统"],
    ["熟练进行数据库性能优化", "PostgreSQL"],
  ])("rejects fact-strength escalation: %s", (text, sourceText) => {
    const facts = buildCandidateFactRegistry(profile());
    const violations = evaluateGroundedClaim(
      "claim",
      { text, sourceFactIds: [factId(facts, sourceText)], kind: "fact" },
      facts,
      buildJobRequirementFacts(jd(), facts),
    );
    expect(violations.map((item) => item.category)).toContain("FACT_STRENGTH_ESCALATION");
  });

  it("rejects missing, unknown, and JD requirement IDs but allows format-only headings", () => {
    const facts = buildCandidateFactRegistry(profile());
    const requirements = buildJobRequirementFacts(jd(), facts);
    expect(evaluateGroundedClaim("a", { text: "TypeScript", sourceFactIds: [], kind: "fact" }, facts, requirements)
      .map((item) => item.category)).toContain("MISSING_FACT_SOURCE");
    expect(evaluateGroundedClaim("b", { text: "TypeScript", sourceFactIds: ["F_FAKE_999"], kind: "fact" }, facts, requirements)
      .map((item) => item.category)).toContain("UNKNOWN_FACT_ID");
    expect(evaluateGroundedClaim("c", { text: "完成 LLM API 接入", sourceFactIds: [requirements[0].id], kind: "fact" }, facts, requirements)
      .map((item) => item.category)).toContain("JD_REQUIREMENT_AS_FACT");
    expect(evaluateGroundedClaim("d", { text: "专业技能", sourceFactIds: [], kind: "format" }, facts, requirements)).toEqual([]);
  });

  it("strips all internal fact IDs from the public business result", () => {
    const facts = buildCandidateFactRegistry(profile());
    const value = grounded({
      text: "具备 TypeScript 基础",
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact",
    });
    expect(JSON.stringify(stripGroundingMetadata(value))).not.toContain("sourceFactIds");
    expect(JSON.stringify(stripGroundingMetadata(value))).not.toContain("F_SKL_");
  });
});

describe("factuality repair and safety", () => {
  it("repairs one factuality failure and records only safe metadata", async () => {
    const facts = buildCandidateFactRegistry(profile());
    const unsafe = grounded({
      text: "完成 OpenAI-compatible LLM API 接入",
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact",
    });
    const fakeClient = {
      structuredCompletion: vi.fn()
        .mockResolvedValueOnce({ data: unsafe, metadata: metadata(), usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } })
        .mockResolvedValueOnce({
          data: {
            repairs: [{
              targetId: "T1",
              action: "replace",
              replacement: {
                text: "具备 TypeScript 基础",
                sourceFactIds: [factId(facts, "TypeScript")],
                kind: "fact",
              },
            }],
          },
          metadata: metadata(),
          usage: { prompt_tokens: 11, completion_tokens: 21, total_tokens: 32 },
        }),
      recordSafeObservation: vi.fn(),
      recordFallback: vi.fn(),
    } as unknown as LLMClient;
    const provider = new LLMTailoredResumeWriterProvider(fakeClient);
    const output = await provider.write({ profile: profile(), baseResumeMarkdown: "", jdAnalysis: jd() });
    expect(output.diagnostics.factualityStatus).toBe("pass");
    expect(output.diagnostics.factualityRepairCount).toBe(1);
    expect(output.diagnostics.jsonRepairCount).toBe(0);
    expect(output.diagnostics).toMatchObject({
      repairJsonStatus: "passed",
      repairEnvelopeStatus: "passed",
      repairTargetCoverageStatus: "passed",
      repairPatchStructureStatus: "passed",
      repairPatchSemanticStatus: "passed",
      repairScopeStatus: "passed",
      repairApplyStatus: "passed",
      postRepairSchemaStatus: "passed",
      postRepairFactualityStatus: "passed",
      repairExpectedTargetCount: 1,
      repairReceivedCount: 1,
      repairAcceptedPatchCount: 1,
      repairDiagnosticIssueCount: 0,
    });
    expect(vi.mocked(fakeClient.structuredCompletion)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fakeClient.structuredCompletion).mock.calls[0][0])
      .toMatchObject({ normalizeParsedJson: expect.any(Function) });
    expect(vi.mocked(fakeClient.structuredCompletion).mock.calls[1][0])
      .toMatchObject({
        schemaName: "grounded_text_factuality_repair_patch",
        allowJsonRepair: false,
        allowFinalizationRetry: false,
      });
    expect(
      JSON.stringify(
        vi.mocked(fakeClient.structuredCompletion).mock.calls[1][0].messages,
      ),
    ).not.toContain("outputContract");
    expect(vi.mocked(fakeClient.recordSafeObservation).mock.calls[0][0].metadata)
      .toMatchObject({
        groundedNormalizationApplied: false,
        defaultedApplicationMaterialArrayCount: 0,
        defaultedApplicationMaterialPaths: [],
        canonicalizedSectionTypeCount: 0,
        canonicalizedSectionOrderCount: 0,
        deduplicatedSourceFactIdCount: 0,
        sourceFactIdLimit: 8,
        factualityViolationCountBeforeRepair: expect.any(Number),
        factualityRepairTargetCount: 1,
        factualityRepairPatchCount: 1,
        factualityRepairApplied: true,
        factualityViolationCountAfterRepair: 0,
        factualityViolationsIntroduced: 0,
        factualityRepairScopeViolation: false,
        repairJsonStatus: "passed",
        repairEnvelopeStatus: "passed",
        repairTargetCoverageStatus: "passed",
        repairPatchStructureStatus: "passed",
        repairPatchSemanticStatus: "passed",
        repairScopeStatus: "passed",
        repairApplyStatus: "passed",
        postRepairSchemaStatus: "passed",
        postRepairFactualityStatus: "passed",
        repairExpectedTargetCount: 1,
        repairReceivedCount: 1,
        repairAcceptedPatchCount: 1,
        repairDiagnosticIssueCount: 0,
        sectionCount: 6,
        sectionLinesLimit: 2,
        sectionLineCounts: [1, 0, 0, 0, 0, 0],
        maximumSectionLinesObserved: 1,
        sectionLineCardinalityViolationCount: 0,
        sectionLineCardinalityViolationPaths: [],
        skillsSectionLineCount: 0,
      });
    const storedMetadata = vi.mocked(
      fakeClient.recordSafeObservation,
    ).mock.calls[0][0].metadata as Record<string, unknown>;
    for (const key of [
      "repairJsonStatus",
      "repairEnvelopeStatus",
      "repairTargetCoverageStatus",
      "repairPatchStructureStatus",
      "repairPatchSemanticStatus",
      "repairScopeStatus",
      "repairApplyStatus",
      "postRepairSchemaStatus",
      "postRepairFactualityStatus",
      "repairExpectedTargetCount",
      "repairReceivedCount",
      "repairAcceptedPatchCount",
    ] as const) {
      expect(storedMetadata[key]).toBe(output.diagnostics[key]);
    }
    const recorded = JSON.stringify(vi.mocked(fakeClient.recordSafeObservation).mock.calls);
    expect(recorded).not.toContain("完成 OpenAI-compatible");
    expect(recorded).not.toContain(factId(facts, "TypeScript"));
    expect(recorded).not.toContain("currentStructuredResult");
    expect(recorded).not.toContain("reasoning_content");
  });

  it("fails after one unsuccessful factuality repair and never falls back", async () => {
    const facts = buildCandidateFactRegistry(profile());
    const unsafe = grounded({
      text: "开发过 AI 应用项目",
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact",
    });
    const fakeClient = {
      structuredCompletion: vi.fn()
        .mockResolvedValueOnce({ data: unsafe, metadata: metadata(), usage: {} })
        .mockResolvedValueOnce({
          data: {
            repairs: [{
              targetId: "T1",
              action: "replace",
              replacement: {
                text: "开发过 AI 应用项目",
                sourceFactIds: [factId(facts, "TypeScript")],
                kind: "fact",
              },
            }],
          },
          metadata: metadata(),
          usage: {},
        }),
      recordSafeObservation: vi.fn(),
      recordFallback: vi.fn(),
    } as unknown as LLMClient;
    const fallback = { write: vi.fn(new MockTailoredResumeWriterProvider().write.bind(new MockTailoredResumeWriterProvider())) };
    const provider = new LLMTailoredResumeWriterProvider(fakeClient, fallback, true);
    await expect(provider.write({ profile: profile(), baseResumeMarkdown: "", jdAnalysis: jd() }))
      .rejects.toBeInstanceOf(TailoredResumeFactualityError);
    expect(vi.mocked(fakeClient.structuredCompletion)).toHaveBeenCalledTimes(2);
    expect(fallback.write).not.toHaveBeenCalled();
    expect(vi.mocked(fakeClient.recordFallback)).not.toHaveBeenCalled();
  });

  it("records safe semantic diagnostics and atomically rejects all patches", async () => {
    const facts = buildCandidateFactRegistry(profile());
    const unsafe = grounded({
      text: "完成 OpenAI-compatible LLM API 接入",
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact",
    });
    const orderedIds = facts.slice(0, 2).map((fact) => fact.id);
    const privateReplacement = "PRIVATE_REPAIR_REPLACEMENT";
    const fakeClient = {
      structuredCompletion: vi.fn()
        .mockResolvedValueOnce({
          data: unsafe,
          metadata: metadata(),
          usage: {},
        })
        .mockResolvedValueOnce({
          data: {
            repairs: [{
              targetId: "T1",
              action: "replace",
              replacement: {
                text: privateReplacement,
                sourceFactIds: [...orderedIds].reverse(),
                kind: "fact",
              },
            }],
          },
          metadata: metadata(),
          usage: {},
        }),
      recordSafeObservation: vi.fn(),
      recordFallback: vi.fn(),
    } as unknown as LLMClient;
    const provider = new LLMTailoredResumeWriterProvider(fakeClient);

    let caught: TailoredResumeFactualityError | undefined;
    try {
      await provider.write({
        profile: profile(),
        baseResumeMarkdown: "",
        jdAnalysis: jd(),
      });
    } catch (error) {
      caught = error as TailoredResumeFactualityError;
    }
    expect(caught).toBeInstanceOf(TailoredResumeFactualityError);
    expect(caught?.code).toBe("FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID");
    expect(caught?.diagnostics).toMatchObject({
      repairReceivedCount: 1,
      repairAcceptedPatchCount: 0,
      repairTargetCoverageStatus: "passed",
      repairPatchStructureStatus: "passed",
      repairPatchSemanticStatus: "failed",
      repairApplyStatus: "not_reached",
      postRepairFactualityStatus: "not_reached",
      repairDiagnosticCategories: [
        "SOURCE_FACT_IDS_ORDER_MISMATCH",
      ],
    });
    const recorded = JSON.stringify(
      vi.mocked(fakeClient.recordSafeObservation).mock.calls,
    );
    expect(recorded).toContain("SOURCE_FACT_IDS_ORDER_MISMATCH");
    expect(recorded).not.toContain(privateReplacement);
    for (const id of orderedIds) expect(recorded).not.toContain(id);
    expect(vi.mocked(fakeClient.structuredCompletion)).toHaveBeenCalledTimes(2);
  });

  it("does not spend a factuality repair request when the request policy disables it", async () => {
    const facts = buildCandidateFactRegistry(profile());
    const unsafe = grounded({
      text: "开发过 AI 应用项目",
      sourceFactIds: [factId(facts, "TypeScript")],
      kind: "fact",
    });
    const fakeClient = {
      structuredCompletion: vi.fn().mockResolvedValue({
        data: unsafe,
        metadata: metadata(),
        usage: {},
      }),
      recordSafeObservation: vi.fn(),
      recordFallback: vi.fn(),
    } as unknown as LLMClient;
    const provider = new LLMTailoredResumeWriterProvider(fakeClient);
    await expect(provider.write({
      profile: profile(),
      baseResumeMarkdown: "",
      jdAnalysis: jd(),
      requestPolicy: {
        allowTransportRetry: false,
        allowJsonRepair: false,
        allowFactualityRepair: false,
        allowFinalizationRetry: true,
      },
    })).rejects.toBeInstanceOf(TailoredResumeFactualityError);
    expect(vi.mocked(fakeClient.structuredCompletion)).toHaveBeenCalledOnce();
    expect(vi.mocked(fakeClient.structuredCompletion).mock.calls[0][0]).toMatchObject({
      allowTransportRetry: false,
      allowJsonRepair: false,
      allowFinalizationRetry: true,
      finalizationRetryMessages: expect.any(Array),
    });
  });

  it("does not use Mock fallback after a structural provider failure", async () => {
    const fakeClient = {
      structuredCompletion: vi.fn().mockRejectedValue(new Error("structural failure")),
      recordSafeObservation: vi.fn(),
      recordFallback: vi.fn(),
    } as unknown as LLMClient;
    const fallback = { write: vi.fn(new MockTailoredResumeWriterProvider().write.bind(new MockTailoredResumeWriterProvider())) };
    const provider = new LLMTailoredResumeWriterProvider(fakeClient, fallback, true);
    await expect(provider.write({ profile: profile(), baseResumeMarkdown: "", jdAnalysis: jd() }))
      .rejects.toThrow("structural failure");
    expect(fallback.write).not.toHaveBeenCalled();
    expect(vi.mocked(fakeClient.recordFallback)).not.toHaveBeenCalled();
  });

  it("reports only categories, paths, and safe summaries", () => {
    const facts = buildCandidateFactRegistry(profile());
    const report = evaluateTailoredResumeFactuality(
      grounded({
        text: "完成 OpenAI-compatible LLM API 接入",
        sourceFactIds: [factId(facts, "TypeScript")],
        kind: "fact",
      }),
      facts,
      buildJobRequirementFacts(jd(), facts),
    );
    const serialized = JSON.stringify(report.violations);
    expect(serialized).toContain("INVENTED_LLM_EXPERIENCE");
    expect(serialized).not.toContain("demo@example.invalid");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("reasoning_content");
  });
});
