import { describe, expect, it, vi } from "vitest";
import {
  buildGroundedSectionOutputContract,
  classifyGroundedSchemaFailure,
  GROUNDED_CONTRACT_SHAPE,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_SKILLS_SECTION_EXAMPLE,
  GROUNDED_TAILORED_RESUME_LIMITS,
} from "@/services/ai/grounded-tailored-resume-contract";
import {
  groundedSectionSchema,
  groundedTailoredResumeOutputContract,
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
} from "@/services/ai/tailored-resume-grounding";
import {
  normalizeGroundedTailoredResume,
  safeGroundedNormalizationMetadata,
} from "@/services/ai/tailored-resume-grounded-normalizer";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import {
  summarizeSchemaIssues,
} from "@/services/ai/schema-diagnostics";
import {
  buildCandidateFactRegistry,
  buildJobRequirementFacts,
} from "@/services/ai/candidate-fact-registry";
import {
  buildGroundedTailoredResumeMessages,
} from "@/services/ai/tailored-resume-writer";
import {
  buildStructuredOutputInstruction,
} from "@/services/ai/llm-client";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

function goalLine(index = 0) {
  return {
    text: `计划继续学习${index}`,
    sourceFactIds: [] as string[],
    kind: "goal" as const,
  };
}

function fixture(lineCount = 1) {
  return {
    sections: GROUNDED_SECTION_TYPES_BY_POSITION.map((type, order) => ({
      type,
      title: `section-${order}`,
      lines: Array.from({ length: lineCount }, (_, index) => goalLine(index)),
      order,
    })),
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [goalLine()],
      applicationEmail: [goalLine()],
      recruiterMessage: [goalLine()],
    },
  };
}

function safeSchemaDiagnostics(value: unknown) {
  const parsed = groundedTailoredResumeSchema.safeParse(value);
  if (parsed.success) throw new Error("Fixture must fail.");
  return summarizeSchemaIssues(
    "grounded_tailored_resume_result",
    parsed.error.issues,
    value,
    groundedTailoredResumeSchema,
  );
}

describe("Grounded section line budget", () => {
  it("defines the unchanged zero-to-two budget once", () => {
    expect(GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMin).toBe(0);
    expect(GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax).toBe(2);
    expect(GROUNDED_CONTRACT_SHAPE).toMatchObject({
      sectionLinesMinimum: 0,
      sectionLinesLimit: 2,
    });
  });

  it.each(GROUNDED_SECTION_TYPES_BY_POSITION)(
    "applies the same 0..2 schema boundary to %s",
    (type) => {
      for (const count of [0, 1, 2]) {
        expect(groundedSectionSchema.safeParse({
          type,
          title: type,
          lines: Array.from({ length: count }, (_, index) => goalLine(index)),
          order: 0,
        }).success).toBe(true);
      }
      for (const count of [3, 6]) {
        expect(groundedSectionSchema.safeParse({
          type,
          title: type,
          lines: Array.from({ length: count }, (_, index) => goalLine(index)),
          order: 0,
        }).success).toBe(false);
      }
    },
  );

  it("rejects missing, non-array, and malformed lines", () => {
    const missing = fixture() as Record<string, unknown>;
    delete (
      (missing.sections as Array<Record<string, unknown>>)[0]
    ).lines;
    expect(groundedTailoredResumeSchema.safeParse(missing).success).toBe(false);

    const nonArray = fixture() as unknown as {
      sections: Array<{ lines: unknown }>;
    };
    nonArray.sections[0].lines = "not-an-array";
    expect(groundedTailoredResumeSchema.safeParse(nonArray).success).toBe(false);

    const malformed = fixture();
    delete (
      malformed.sections[0].lines[0] as unknown as Record<string, unknown>
    ).sourceFactIds;
    expect(groundedTailoredResumeSchema.safeParse(malformed).success)
      .toBe(false);
  });

  it("keeps a six-line skills array intact for strict rejection", () => {
    const input = fixture();
    input.sections[1].lines = Array.from(
      { length: 6 },
      (_, index) => goalLine(index),
    );
    const normalized = normalizeGroundedTailoredResume(input);
    const sections = (normalized.normalized as typeof input).sections;
    expect(sections[1].lines).toHaveLength(6);
    expect(normalized.summary).toMatchObject({
      sectionCount: 6,
      sectionLinesLimit: 2,
      sectionLineCounts: [1, 6, 1, 1, 1, 1],
      maximumSectionLinesObserved: 6,
      sectionLineCardinalityViolationCount: 1,
      sectionLineCardinalityViolationPaths: ["sections[1].lines"],
      skillsSectionLineCount: 6,
    });
    expect(groundedTailoredResumeSchema.safeParse(normalized.normalized).success)
      .toBe(false);
  });

  it("emits only safe section cardinality metadata", () => {
    const input = fixture();
    const privateText = "PRIVATE_SKILLS_TEXT";
    input.sections[1].lines = Array.from(
      { length: 6 },
      (_, index) => ({ ...goalLine(index), text: privateText }),
    );
    const metadata = safeGroundedNormalizationMetadata(
      normalizeGroundedTailoredResume(input).summary,
    );
    expect(metadata).toMatchObject({
      sectionCount: 6,
      sectionLinesLimit: 2,
      sectionLineCounts: [1, 6, 1, 1, 1, 1],
      maximumSectionLinesObserved: 6,
      sectionLineCardinalityViolationCount: 1,
      sectionLineCardinalityViolationPaths: ["sections[1].lines"],
      skillsSectionLineCount: 6,
    });
    expect(JSON.stringify(metadata)).not.toContain(privateText);
    expect(metadata).not.toHaveProperty("sourceFactIds");
  });

  it("classifies only a sole section-line overflow", () => {
    const input = fixture();
    input.sections[1].lines = Array.from(
      { length: 6 },
      (_, index) => goalLine(index),
    );
    const diagnostics = safeSchemaDiagnostics(
      normalizeGroundedTailoredResume(input).normalized,
    );
    expect(diagnostics.issues).toEqual([
      expect.objectContaining({
        category: "ARRAY_TOO_LARGE",
        path: "sections[1].lines",
        maximum: 2,
        actualSize: 6,
      }),
    ]);
    expect(classifyGroundedSchemaFailure(
      "grounded_tailored_resume_result",
      diagnostics,
    )).toBe("SECTION_LINES_CARDINALITY_VIOLATION");

    const multiple = structuredClone(input);
    multiple.sections[2].lines = Array.from(
      { length: 3 },
      (_, index) => goalLine(index),
    );
    expect(classifyGroundedSchemaFailure(
      "grounded_tailored_resume_result",
      safeSchemaDiagnostics(normalizeGroundedTailoredResume(multiple).normalized),
    )).toBeUndefined();
  });

  it("states selective skills grouping and all six policies", () => {
    const contract = buildGroundedSectionOutputContract();
    expect(contract).toContain("lines:0..2 GroundedText");
    expect(contract).toContain("Selective/not exhaustive");
    expect(contract).toContain("no per-skill lines");
    expect(contract).toContain("skills group relevant");
    expect(contract).toContain("all facts");
    for (const type of GROUNDED_SECTION_TYPES_BY_POSITION) {
      expect(contract).toContain(type);
    }
    expect(contract).not.toContain("one line for each skill");
  });

  it("keeps the fictional skills example schema-valid and within budget", () => {
    expect(GROUNDED_SKILLS_SECTION_EXAMPLE.lines).toHaveLength(1);
    expect(GROUNDED_SKILLS_SECTION_EXAMPLE.lines.length)
      .toBeLessThanOrEqual(GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax);
    expect(groundedSectionSchema.safeParse(
      GROUNDED_SKILLS_SECTION_EXAMPLE,
    ).success).toBe(true);
    expect(JSON.stringify(GROUNDED_SKILLS_SECTION_EXAMPLE))
      .not.toMatch(/F_(SKL|EDU|PRJ|EXP)_\d+/);
  });

  it("uses the same numeric budget in schema, contract, and smoke summary", () => {
    const input = fixture(2);
    const normalized = normalizeGroundedTailoredResume(input);
    expect(groundedTailoredResumeSchema.safeParse(normalized.normalized).success)
      .toBe(true);
    expect(buildGroundedSectionOutputContract()).toContain(
      `lines:${GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMin}..${GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax}`,
    );
    expect(normalized.summary.sectionLinesLimit)
      .toBe(GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax);
  });

  it("passes normalization, schema, factuality, and public conversion", () => {
    const normalized = normalizeGroundedTailoredResume(fixture(2));
    const grounded = groundedTailoredResumeSchema.parse(normalized.normalized);
    const facts = buildCandidateFactRegistry(
      fictionalSmokeProfile,
      fictionalSmokeBaseResume,
    );
    expect(evaluateTailoredResumeFactuality(
      grounded,
      facts,
      buildJobRequirementFacts(fictionalSmokeJD, facts),
    ).status).toBe("pass");
    const publicResult = stripGroundingMetadata(grounded);
    expect(publicResult.sections).toHaveLength(6);
    expect(publicResult.sections.every(
      (section) => section.contentMarkdown.split("\n").length <= 2,
    )).toBe(true);
  });

  it("keeps prompt growth below ten percent without changing output tokens", () => {
    const facts = buildCandidateFactRegistry(
      fictionalSmokeProfile,
      fictionalSmokeBaseResume,
    );
    const requirements = buildJobRequirementFacts(fictionalSmokeJD, facts);
    const messages = buildGroundedTailoredResumeMessages(facts, requirements);
    const promptCharacters =
      messages.reduce((total, message) => total + message.content.length, 0) +
      buildStructuredOutputInstruction(
        "grounded_tailored_resume_result",
        groundedTailoredResumeOutputContract,
      ).length;
    expect(promptCharacters).toBe(2938);
    expect(promptCharacters / 2679).toBeLessThanOrEqual(1.1);
    expect(groundedTailoredResumeOutputContract).toContain("<=1600 tokens");
  });

  it("does not call factuality or persistence after schema rejection", () => {
    const input = fixture();
    input.sections[1].lines = Array.from(
      { length: 6 },
      (_, index) => goalLine(index),
    );
    const factuality = vi.fn();
    const persist = vi.fn();
    const parsed = groundedTailoredResumeSchema.safeParse(
      normalizeGroundedTailoredResume(input).normalized,
    );
    if (parsed.success) {
      factuality(parsed.data);
      persist(parsed.data);
    }
    expect(parsed.success).toBe(false);
    expect(factuality).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
