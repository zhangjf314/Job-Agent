import { describe, expect, it } from "vitest";
import {
  buildGroundedArrayCardinalityOutputContract,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_TAILORED_RESUME_LIMITS,
} from "@/services/ai/grounded-tailored-resume-contract";
import {
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
} from "@/services/ai/tailored-resume-grounding";
import {
  normalizeGroundedTailoredResume,
} from "@/services/ai/tailored-resume-grounded-normalizer";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import {
  summarizeSchemaIssues,
} from "@/services/ai/schema-diagnostics";
import type {
  CandidateFact,
  JobRequirementFact,
} from "@/services/ai/candidate-fact-registry";

const factIds = Array.from({
  length: GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax + 1,
}, (_, index) =>
  `F_SKL_${String(index + 1).padStart(3, "0")}`);

function line(sourceFactIds: unknown = [factIds[0]]) {
  return { text: "TypeScript", sourceFactIds, kind: "fact" };
}

function fixture() {
  return {
    sections: GROUNDED_SECTION_TYPES_BY_POSITION.map((type, order) => ({
      type,
      title: `section-${order}`,
      lines: [line()],
      order,
    })),
    rewriteExplanation: [],
    changedSections: [
      ...GROUNDED_SECTION_TYPES_BY_POSITION.slice(
        1,
        GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax + 1,
      ),
    ] as string[],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [line()],
      applicationEmail: [line()],
      recruiterMessage: [line()],
    },
  };
}

const facts: CandidateFact[] = factIds.map((id) => ({
  id,
  category: "skill",
  text: "TypeScript",
  canonicalTerms: ["typescript"],
}));
const requirements: JobRequirementFact[] = [{
  id: "J_REQ_001",
  text: "LLM",
  canonicalTerms: ["llm"],
}];

describe("Grounded array cardinality contracts", () => {
  it("uses one shared pair of limits in the schema and contract", () => {
    expect(GROUNDED_TAILORED_RESUME_LIMITS).toEqual({
      changedSectionsMax: 2,
      sourceFactIdsMax: 8,
      rewriteExplanationMax: 2,
      rewriteExplanationItemMinChars: 1,
      sectionLinesMin: 0,
      sectionLinesMax: 2,
    });
    const contract = buildGroundedArrayCardinalityOutputContract();
    expect(contract).toContain("changedSections:0..2 unique canonical");
    expect(contract).toContain("most materially changed, not exhaustive");
    expect(contract).toContain("sourceFactIds:0..8 unique supplied F_*");
    expect(contract).toContain("minimum sufficient evidence");
    expect(contract).toContain(
      "do not emit extra lines merely to use every fact",
    );
  });

  it.each([0, 1, 2])("accepts %i changed section types", (count) => {
    const input = fixture();
    input.changedSections = GROUNDED_SECTION_TYPES_BY_POSITION.slice(0, count);
    expect(groundedTailoredResumeSchema.safeParse(input).success).toBe(true);
  });

  it.each([3, 4])("strictly rejects %i changed section types", (count) => {
    const input = fixture();
    input.changedSections = GROUNDED_SECTION_TYPES_BY_POSITION.slice(0, count);
    expect(groundedTailoredResumeSchema.safeParse(input).success).toBe(false);
    expect(normalizeGroundedTailoredResume(input).summary.changedSectionsCount)
      .toBe(count);
  });

  it("rejects duplicate and non-canonical changed section values", () => {
    for (const changedSections of [
      ["skills", "skills"],
      ["专业技能"],
    ]) {
      const input = fixture();
      input.changedSections = changedSections;
      expect(groundedTailoredResumeSchema.safeParse(input).success).toBe(false);
    }
  });

  it.each([1, 8])("accepts %i unique source fact IDs", (count) => {
    const input = fixture();
    input.sections[0].lines = [line(factIds.slice(0, count))];
    expect(groundedTailoredResumeSchema.safeParse(input).success).toBe(true);
  });

  it("leaves nine source IDs intact for a strict schema failure", () => {
    const input = fixture();
    input.sections[0].lines = [line(factIds)];
    const normalized = normalizeGroundedTailoredResume(input);
    const parsed = groundedTailoredResumeSchema.safeParse(normalized.normalized);
    expect(
      (normalized.normalized as typeof input)
        .sections[0].lines[0].sourceFactIds,
    ).toHaveLength(9);
    expect(normalized.summary.maximumSourceFactIdsObserved).toBe(9);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Over-limit fixture must fail.");
    const diagnostics = summarizeSchemaIssues(
      "grounded_tailored_resume_result",
      parsed.error.issues,
      normalized.normalized,
      groundedTailoredResumeSchema,
    );
    expect(diagnostics.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "sections[0].lines[0].sourceFactIds",
        category: "ARRAY_TOO_LARGE",
        maximum: 8,
        actualSize: 9,
      }),
    ]));
  });

  it("deduplicates IDs in original order but never hides unknown or JD IDs", () => {
    const input = fixture();
    input.sections[0].lines = [
      line([factIds[1], factIds[0], factIds[1]]),
    ];
    const normalized = normalizeGroundedTailoredResume(input);
    expect(
      (normalized.normalized as typeof input)
        .sections[0].lines[0].sourceFactIds,
    ).toEqual([factIds[1], factIds[0]]);

    for (const [ids, category] of [
      [["F_UNKNOWN_001"], "UNKNOWN_FACT_ID"],
      [["J_REQ_001"], "JD_REQUIREMENT_AS_FACT"],
      [[], "MISSING_FACT_SOURCE"],
    ] as const) {
      const invalid = fixture();
      invalid.sections[0].lines = [line([...ids])];
      const grounded = groundedTailoredResumeSchema.parse(
        normalizeGroundedTailoredResume(invalid).normalized,
      );
      expect(
        evaluateTailoredResumeFactuality(
          grounded,
          facts,
          requirements,
        ).violations.map((item) => item.category),
      ).toContain(category);
    }
  });

  it("rejects non-string and missing source IDs", () => {
    const nonString = fixture();
    nonString.sections[0].lines = [line([factIds[0], 1])];
    expect(groundedTailoredResumeSchema.safeParse(nonString).success)
      .toBe(false);
    const missing = fixture();
    delete (
      missing.sections[0].lines[0] as Record<string, unknown>
    ).sourceFactIds;
    expect(groundedTailoredResumeSchema.safeParse(missing).success)
      .toBe(false);
  });

  it("preserves split evidence lines through schema, factuality, and Markdown", () => {
    const input = fixture();
    input.sections[0].lines = [
      line(factIds.slice(
        0,
        GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax,
      )),
      line(factIds.slice(
        GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax,
      )),
    ];
    const grounded = groundedTailoredResumeSchema.parse(
      normalizeGroundedTailoredResume(input).normalized,
    );
    expect(
      evaluateTailoredResumeFactuality(grounded, facts, requirements).status,
    ).toBe("pass");
    expect(stripGroundingMetadata(grounded).sections[0].contentMarkdown)
      .toBe("TypeScript\nTypeScript");
  });

  it("passes the complete valid fixture end to end", () => {
    const normalized = normalizeGroundedTailoredResume(fixture());
    const grounded = groundedTailoredResumeSchema.parse(normalized.normalized);
    expect(normalized.summary).toMatchObject({
      changedSectionsCount: 2,
      maximumSourceFactIdsObserved: 1,
      changedSectionsLimit: 2,
      sourceFactIdLimit: 8,
    });
    expect(
      evaluateTailoredResumeFactuality(grounded, facts, requirements).status,
    ).toBe("pass");
    expect(stripGroundingMetadata(grounded).sections).toHaveLength(6);
  });
});
