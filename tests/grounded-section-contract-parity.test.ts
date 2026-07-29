import { describe, expect, it, vi } from "vitest";
import {
  buildGroundedSectionOutputContract,
  GROUNDED_APPLICATION_MATERIAL_KEYS,
  GROUNDED_CONTRACT_SHAPE,
  GROUNDED_ROOT_KEYS,
  GROUNDED_SECTION_COUNT,
  GROUNDED_SECTION_KEYS,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_SOURCE_FACT_ID_LIMIT,
  GROUNDED_TAILORED_RESUME_LIMITS,
  GROUNDED_TEXT_KEYS,
} from "@/services/ai/grounded-tailored-resume-contract";
import {
  groundedApplicationMaterialsSchema,
  groundedSectionSchema,
  groundedTailoredResumeOutputContract,
  groundedTailoredResumeSchema,
  groundedTextSchema,
  stripGroundingMetadata,
  type GroundedTailoredResume,
} from "@/services/ai/tailored-resume-grounding";
import {
  normalizeGroundedTailoredResume,
} from "@/services/ai/tailored-resume-grounded-normalizer";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import {
  buildCandidateFactRegistry,
  buildJobRequirementFacts,
} from "@/services/ai/candidate-fact-registry";
import {
  buildGroundedTailoredResumeMessages,
  LLMTailoredResumeWriterProvider,
} from "@/services/ai/tailored-resume-writer";
import {
  buildStructuredOutputInstruction,
  type LLMClient,
} from "@/services/ai/llm-client";
import { resumeSectionSchema } from "@/schemas/resume";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

const expectedSectionKeys = ["type", "title", "lines", "order"];

function groundedText(text = "计划持续学习并完善求职材料") {
  return {
    text,
    sourceFactIds: [] as string[],
    kind: "goal" as const,
  };
}

function sixSectionFixture(): GroundedTailoredResume {
  return {
    sections: GROUNDED_SECTION_TYPES_BY_POSITION.map((type, order) => ({
      type,
      title: `section-${order}`,
      order,
      lines: [groundedText()],
    })),
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [groundedText()],
      applicationEmail: [groundedText()],
      recruiterMessage: [groundedText()],
    },
  };
}

describe("Grounded section contract parity", () => {
  it("defines the complete shared contract shape once", () => {
    expect(GROUNDED_CONTRACT_SHAPE).toEqual({
      topLevelKeys: GROUNDED_ROOT_KEYS,
      sectionKeys: GROUNDED_SECTION_KEYS,
      groundedTextKeys: GROUNDED_TEXT_KEYS,
      applicationMaterialKeys: GROUNDED_APPLICATION_MATERIAL_KEYS,
      sectionTypesByPosition: GROUNDED_SECTION_TYPES_BY_POSITION,
      sectionCount: 6,
      changedSectionsLimit: 2,
      sourceFactIdLimit: 8,
    });
    expect(GROUNDED_SECTION_KEYS).toEqual(expectedSectionKeys);
    expect(GROUNDED_SECTION_COUNT).toBe(6);
    expect(GROUNDED_SOURCE_FACT_ID_LIMIT).toBe(8);
    expect(GROUNDED_TAILORED_RESUME_LIMITS).toEqual({
      changedSectionsMax: 2,
      sourceFactIdsMax: 8,
      rewriteExplanationMax: 2,
      rewriteExplanationItemMinChars: 1,
    });
  });

  it("keeps contract, Grounded schemas, and normalizer keys aligned", () => {
    expect(groundedSectionSchema.keyof().options).toEqual(
      GROUNDED_SECTION_KEYS,
    );
    expect(groundedTextSchema.keyof().options).toEqual(GROUNDED_TEXT_KEYS);
    expect(groundedApplicationMaterialsSchema.keyof().options).toEqual(
      GROUNDED_APPLICATION_MATERIAL_KEYS,
    );
    expect(groundedTailoredResumeSchema.keyof().options).toEqual(
      GROUNDED_ROOT_KEYS,
    );

    const input = sixSectionFixture();
    for (const key of GROUNDED_SECTION_KEYS) {
      const altered = structuredClone(input) as GroundedTailoredResume;
      delete (
        altered.sections[0] as unknown as Record<string, unknown>
      )[key];
      expect(groundedTailoredResumeSchema.safeParse(altered).success).toBe(
        false,
      );
      const normalized = normalizeGroundedTailoredResume(altered).normalized;
      expect(
        groundedTailoredResumeSchema.safeParse(normalized).success,
      ).toBe(key === "type" || key === "order");
    }
  });

  it("keeps the public section shape separate from the Grounded shape", () => {
    expect(resumeSectionSchema.keyof().options).toEqual([
      "type",
      "title",
      "contentMarkdown",
      "order",
    ]);
    const converted = stripGroundingMetadata(sixSectionFixture());
    expect(converted.sections).toHaveLength(6);
    expect(Object.keys(converted.sections[0])).toEqual([
      "type",
      "title",
      "contentMarkdown",
      "order",
    ]);
    expect(converted.sections[0]).not.toHaveProperty("lines");
  });

  it("builds one explicit production section contract with no old alias", () => {
    const sectionContract = buildGroundedSectionOutputContract();
    expect(sectionContract).toContain(
      "each exactly {type,title,lines,order};",
    );
    expect(sectionContract).toContain("sections:exactly 6");
    expect(sectionContract).toContain(
      "fixed order summary,skills,projects,experiences,education,others",
    );
    expect(sectionContract).toContain("no aliases/extra fields");
    expect(sectionContract).not.toContain("items:{");
    expect(sectionContract).not.toContain("sections:4..6");
    expect(
      groundedTailoredResumeOutputContract.split(sectionContract),
    ).toHaveLength(2);
  });

  it("keeps the production prompt within its previous character budget", () => {
    const facts = buildCandidateFactRegistry(
      fictionalSmokeProfile,
      fictionalSmokeBaseResume,
    );
    const requirements = buildJobRequirementFacts(fictionalSmokeJD, facts);
    const messages = buildGroundedTailoredResumeMessages(facts, requirements);
    const productionPromptCharacters =
      messages.reduce((total, message) => total + message.content.length, 0) +
      buildStructuredOutputInstruction(
        "grounded_tailored_resume_result",
        groundedTailoredResumeOutputContract,
      ).length;
    expect(productionPromptCharacters).toBeLessThanOrEqual(2685);
    expect(productionPromptCharacters / 2486).toBeLessThanOrEqual(1.08);
  });

  it("passes topology, normalization, schema, factuality, and conversion", () => {
    const input = sixSectionFixture();
    const normalized = normalizeGroundedTailoredResume(input);
    const grounded = groundedTailoredResumeSchema.parse(normalized.normalized);
    const facts = buildCandidateFactRegistry(
      fictionalSmokeProfile,
      fictionalSmokeBaseResume,
    );
    const report = evaluateTailoredResumeFactuality(
      grounded,
      facts,
      buildJobRequirementFacts(fictionalSmokeJD, facts),
    );
    expect(normalized.summary).toMatchObject({
      canonicalizedSectionTypes: 0,
      canonicalizedSectionOrders: 0,
    });
    expect(report.status).toBe("pass");
    expect(stripGroundingMetadata(grounded).sections).toHaveLength(6);
  });

  it("rejects the source-audited old section shape", () => {
    const oldShape = {
      ...sixSectionFixture(),
      sections: GROUNDED_SECTION_TYPES_BY_POSITION.map((type) => ({
        type,
        items: [groundedText()],
      })),
    };
    expect(() => normalizeGroundedTailoredResume(oldShape)).toThrow(
      /unsupported field/,
    );
    expect(groundedTailoredResumeOutputContract).not.toContain("items:{");
  });

  it("canonicalizes both type and order from the fixed position", () => {
    const input = sixSectionFixture();
    input.sections[0].type = "others";
    input.sections[0].order = 99;
    input.sections[5].type = "summary";
    input.sections[5].order = 0;
    const result = normalizeGroundedTailoredResume(input);
    const sections = (result.normalized as GroundedTailoredResume).sections;
    expect(sections.map(({ type }) => type)).toEqual(
      GROUNDED_SECTION_TYPES_BY_POSITION,
    );
    expect(sections.map(({ order }) => order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.summary).toMatchObject({
      canonicalizedSectionTypes: 2,
      canonicalizedSectionOrders: 2,
    });
  });

  it("does not relax application-material or GroundedText rules", () => {
    const missingMaterial = sixSectionFixture() as GroundedTailoredResume & {
      applicationMaterials: Record<string, unknown>;
    };
    delete (
      missingMaterial.applicationMaterials as unknown as Record<
        string,
        unknown
      >
    ).recruiterMessage;
    expect(
      groundedTailoredResumeSchema.safeParse(
        normalizeGroundedTailoredResume(missingMaterial).normalized,
      ).success,
    ).toBe(false);

    const missingFactField = sixSectionFixture();
    delete (
      missingFactField.sections[0].lines[0] as unknown as Record<
        string,
        unknown
      >
    ).kind;
    expect(
      groundedTailoredResumeSchema.safeParse(
        normalizeGroundedTailoredResume(missingFactField).normalized,
      ).success,
    ).toBe(false);
  });

  it("passes the current Grounded contract to the production provider", async () => {
    const result = sixSectionFixture();
    const fakeClient = {
      structuredCompletion: vi.fn().mockResolvedValue({
        data: result,
        usage: {},
        metadata: {
          requestId: "test",
          model: "test",
          latencyMs: 1,
          retryCount: 0,
          repairCount: 0,
          finalizationRetryCount: 0,
          externalRequestCount: 1,
          reasoningFieldPresent: false,
          thinkingModeRequested: "disabled",
          groundedNormalizationSummary: {
            groundedNormalizationApplied: false,
            defaultedApplicationMaterialArrays: [],
            canonicalizedSectionTypes: 0,
            canonicalizedSectionOrders: 0,
            deduplicatedFactIdCount: 0,
            sourceFactIdLimit: 8,
          },
          responseSafetySummary: {
            responseId: "test",
            choiceCount: 1,
            firstChoicePresent: true,
            messagePresent: true,
            contentState: "present",
            contentCharacterLength: 1,
            contentByteLength: 1,
            finishReason: "stop",
            reasoningFieldPresent: false,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            outputLimitReached: false,
          },
        },
      }),
      recordSafeObservation: vi.fn(),
    } as unknown as LLMClient;
    const provider = new LLMTailoredResumeWriterProvider(fakeClient);
    await provider.write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
      requestPolicy: { allowFactualityRepair: false },
    });
    expect(vi.mocked(fakeClient.structuredCompletion)).toHaveBeenCalledOnce();
    expect(vi.mocked(fakeClient.structuredCompletion).mock.calls[0][0])
      .toMatchObject({
        schema: groundedTailoredResumeSchema,
        outputContract: groundedTailoredResumeOutputContract,
        normalizeParsedJson: normalizeGroundedTailoredResume,
      });
  });
});
