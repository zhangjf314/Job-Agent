import { describe, expect, it, vi } from "vitest";
import { getAIConfig } from "@/lib/ai-config";
import type {
  CandidateFact,
  JobRequirementFact,
} from "@/services/ai/candidate-fact-registry";
import {
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
} from "@/services/ai/tailored-resume-grounding";
import {
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_SOURCE_FACT_ID_LIMIT,
  normalizeGroundedTailoredResume,
  REQUIRED_APPLICATION_MATERIAL_PATHS,
} from "@/services/ai/tailored-resume-grounded-normalizer";
import { GROUNDED_SECTION_COUNT } from "@/services/ai/grounded-tailored-resume-contract";
import {
  evaluateTailoredResumeFactuality,
} from "@/services/ai/tailored-resume-factuality";
import {
  LLMClient,
} from "@/services/ai/llm-client";
import type { LLMCallObserver } from "@/services/ai/llm-observability";
import { getApplicationMaterials } from "@/services/resume-application-materials";

const factIds = Array.from({ length: GROUNDED_SOURCE_FACT_ID_LIMIT }, (_, index) =>
  `F_SKL_${String(index + 1).padStart(3, "0")}`);

function claim(sourceFactIds: unknown = [factIds[0]]) {
  return {
    text: "TypeScript",
    sourceFactIds,
    kind: "fact",
  };
}

type RawFixture = {
  sections: Array<{
    type: string;
    title: string;
    lines: Array<ReturnType<typeof claim>>;
    order: number;
  }>;
  rewriteExplanation: string[];
  changedSections: string[];
  missingFields: string[];
  improvementQuestions: string[];
  qualityWarnings: string[];
  applicationMaterials: Record<
    "selfIntroduction" | "applicationEmail" | "recruiterMessage",
    Array<ReturnType<typeof claim>>
  >;
};

function rawFixture(): RawFixture {
  return {
    sections: Array.from({ length: GROUNDED_SECTION_COUNT }, (_, index) => ({
      type: GROUNDED_SECTION_TYPES_BY_POSITION[index],
      title: `section ${index}`,
      lines: [claim()],
      order: index,
    })),
    rewriteExplanation: [],
    changedSections: [],
    missingFields: [],
    improvementQuestions: [],
    qualityWarnings: [],
    applicationMaterials: {
      selfIntroduction: [claim()],
      applicationEmail: [claim()],
      recruiterMessage: [claim()],
    },
  };
}

function facts(): CandidateFact[] {
  return factIds.map((id) => ({
    id,
    category: "skill",
    text: "TypeScript",
    canonicalTerms: ["typescript"],
  }));
}

const requirements: JobRequirementFact[] = [{
  id: "J_REQ_001",
  text: "LLM",
  canonicalTerms: ["llm"],
}];

describe("strict grounded tailored-resume normalization", () => {
  it("leaves all present application-material arrays unchanged", () => {
    const input = rawFixture();
    const result = normalizeGroundedTailoredResume(input);
    expect((result.normalized as typeof input).applicationMaterials)
      .toEqual(input.applicationMaterials);
    expect(result.summary.defaultedApplicationMaterialArrays).toEqual([]);
  });

  it.each([
    ["one missing", ["applicationEmail"]],
    ["all missing", ["selfIntroduction", "applicationEmail", "recruiterMessage"]],
  ])("does not synthesize required application content when %s", (_name, missing) => {
    const input = rawFixture();
    for (const key of missing) {
      delete input.applicationMaterials[
        key as keyof typeof input.applicationMaterials
      ];
    }
    const result = normalizeGroundedTailoredResume(input);
    expect(result.summary.defaultedApplicationMaterialArrays).toEqual([]);
    expect(groundedTailoredResumeSchema.safeParse(result.normalized).success)
      .toBe(false);
  });

  it.each([null, "private text", { value: "private" }])(
    "does not coerce an invalid existing application-material value: %j",
    (invalid) => {
      const input = rawFixture();
      (input.applicationMaterials as Record<string, unknown>).applicationEmail =
        invalid;
      const result = normalizeGroundedTailoredResume(input);
      expect(
        (result.normalized as typeof input).applicationMaterials.applicationEmail,
      ).toBe(invalid);
      expect(groundedTailoredResumeSchema.safeParse(result.normalized).success)
        .toBe(false);
    },
  );

  it("keeps public conversion valid for real generated material and hides empty cards defensively", () => {
    const parsed = groundedTailoredResumeSchema.parse(rawFixture());
    const publicResult = stripGroundingMetadata(parsed);
    expect(publicResult.applicationMaterials).toEqual({
      selfIntroduction: "TypeScript",
      applicationEmail: "TypeScript",
      recruiterMessage: "TypeScript",
    });
    expect(getApplicationMaterials({ applicationMaterials: {
      selfIntroduction: "",
      applicationEmail: "",
      recruiterMessage: "",
    } })).toBeNull();
  });

  it("keeps canonical section types and order unchanged", () => {
    const input = rawFixture();
    const result = normalizeGroundedTailoredResume(input);
    const sections = (result.normalized as typeof input).sections;
    expect(sections.map((section) => section.type))
      .toEqual(GROUNDED_SECTION_TYPES_BY_POSITION);
    expect(sections.map((section) => section.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.summary.canonicalizedSectionTypes).toBe(0);
    expect(result.summary.canonicalizedSectionOrders).toBe(0);
  });

  it("assigns section types only from fixed output positions", () => {
    const input = rawFixture();
    input.sections[0].type = "invented";
    input.sections[0].order = 99;
    input.sections[0].title = "education";
    delete (input.sections[1] as { type?: string }).type;
    delete (input.sections[1] as { order?: number }).order;
    const result = normalizeGroundedTailoredResume(input);
    const sections = (result.normalized as typeof input).sections;
    expect(sections[0]).toMatchObject({
      type: "summary",
      title: "education",
      order: 0,
    });
    expect(sections[1].type).toBe("skills");
    expect(sections[1].order).toBe(1);
    expect(result.summary.canonicalizedSectionTypes).toBe(2);
    expect(result.summary.canonicalizedSectionOrders).toBe(2);
  });

  it("does not accept a seventh or structurally unknown section", () => {
    const input = rawFixture();
    input.sections.push({
      type: "invented",
      title: "unknown",
      lines: [claim()],
      order: 6,
    });
    const result = normalizeGroundedTailoredResume(input);
    expect((result.normalized as typeof input).sections).toHaveLength(7);
    expect(groundedTailoredResumeSchema.safeParse(result.normalized).success)
      .toBe(false);
  });

  it.each([1, 4, 6, GROUNDED_SOURCE_FACT_ID_LIMIT])(
    "accepts %i unique, bounded source IDs",
    (count) => {
      const input = rawFixture();
      input.sections[0].lines = [claim(factIds.slice(0, count))];
      const normalized = normalizeGroundedTailoredResume(input).normalized;
      expect(groundedTailoredResumeSchema.safeParse(normalized).success).toBe(true);
    },
  );

  it("deduplicates string IDs in original order without storing their values in metadata", () => {
    const input = rawFixture();
    input.sections[0].lines = [claim([
      factIds[1],
      factIds[0],
      factIds[1],
      factIds[2],
      factIds[0],
    ])];
    const result = normalizeGroundedTailoredResume(input);
    expect(
      (result.normalized as typeof input).sections[0].lines[0].sourceFactIds,
    ).toEqual([factIds[1], factIds[0], factIds[2]]);
    expect(result.summary.deduplicatedFactIdCount).toBe(2);
    expect(JSON.stringify(result.summary)).not.toContain("F_SKL_");
  });

  it("never truncates IDs and leaves over-limit data for schema failure", () => {
    const overLimit = [...factIds, "F_SKL_009"];
    const input = rawFixture();
    input.sections[0].lines = [claim(overLimit)];
    const result = normalizeGroundedTailoredResume(input);
    expect(
      (result.normalized as typeof input).sections[0].lines[0].sourceFactIds,
    ).toHaveLength(9);
    expect(groundedTailoredResumeSchema.safeParse(result.normalized).success)
      .toBe(false);
  });

  it("does not normalize mixed or non-array source IDs", () => {
    for (const invalid of [[factIds[0], 42], "F_SKL_001"]) {
      const input = rawFixture();
      input.sections[0].lines = [claim(invalid)];
      const result = normalizeGroundedTailoredResume(input);
      expect(groundedTailoredResumeSchema.safeParse(result.normalized).success)
        .toBe(false);
    }
  });

  it("keeps unknown, JD-only, and missing fact-source failures active", () => {
    for (const [sourceFactIds, expected] of [
      [["F_UNKNOWN_001"], "UNKNOWN_FACT_ID"],
      [["J_REQ_001"], "JD_REQUIREMENT_AS_FACT"],
      [[], "MISSING_FACT_SOURCE"],
    ] as const) {
      const input = rawFixture();
      input.sections[0].lines = [claim([...sourceFactIds])];
      const grounded = groundedTailoredResumeSchema.parse(
        normalizeGroundedTailoredResume(input).normalized,
      );
      expect(
        evaluateTailoredResumeFactuality(grounded, facts(), requirements)
          .violations.map((item) => item.category),
      ).toContain(expected);
    }
  });

  it("normalizes the proven section and six-ID deviations through schema, factuality, and public conversion", () => {
    const input = rawFixture();
    input.sections[1].type = "invalid-a";
    input.sections[3].type = "invalid-b";
    input.sections[2].lines = [claim(factIds.slice(0, 6))];
    const result = normalizeGroundedTailoredResume(input);
    const grounded = groundedTailoredResumeSchema.parse(result.normalized);
    const report = evaluateTailoredResumeFactuality(
      grounded,
      facts(),
      requirements,
    );
    expect(result.summary).toMatchObject({
      canonicalizedSectionTypes: 2,
      deduplicatedFactIdCount: 0,
      defaultedApplicationMaterialArrays: [],
    });
    expect(report.status).toBe("pass");
    expect(stripGroundingMetadata(grounded).sections).toHaveLength(6);
  });

  it("does not disguise the combined real-deviation fixture when all required materials are missing", () => {
    const input = rawFixture();
    input.sections[1].type = "invalid-a";
    input.sections[3].type = "invalid-b";
    input.sections[2].lines = [claim(factIds.slice(0, 6))];
    const materials = input.applicationMaterials as Partial<
      typeof input.applicationMaterials
    >;
    delete materials.selfIntroduction;
    delete materials.applicationEmail;
    delete materials.recruiterMessage;

    const result = normalizeGroundedTailoredResume(input);
    const parsed = groundedTailoredResumeSchema.safeParse(result.normalized);
    expect(result.summary).toMatchObject({
      canonicalizedSectionTypes: 2,
      defaultedApplicationMaterialArrays: [],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Fixture must remain invalid.");
    expect(parsed.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "applicationMaterials.selfIntroduction",
        "applicationMaterials.applicationEmail",
        "applicationMaterials.recruiterMessage",
      ]),
    );
  });

  it("keeps each unknown structural deviation failing after normalization", () => {
    const schemaFailureMutations: Array<
      (input: ReturnType<typeof rawFixture>) => unknown
    > = [
      (input) => {
        delete (input.sections[0].lines[0] as { kind?: string }).kind;
        return input;
      },
      (input) => {
        input.sections[0].lines[0].sourceFactIds = "F_SKL_001";
        return input;
      },
      (input) => {
        (input.sections as unknown) = { bad: true };
        return input;
      },
    ];
    for (const mutate of schemaFailureMutations) {
      const normalized = normalizeGroundedTailoredResume(
        mutate(rawFixture()),
      ).normalized;
      expect(groundedTailoredResumeSchema.safeParse(normalized).success)
        .toBe(false);
    }
    expect(() => normalizeGroundedTailoredResume({ resume: rawFixture() }))
      .toThrow(/unsupported field/);
    const unknownSectionField = rawFixture();
    (unknownSectionField.sections[0] as Record<string, unknown>).private =
      "PRIVATE_VALUE";
    expect(() => normalizeGroundedTailoredResume(unknownSectionField))
      .toThrow(/unsupported field/);
    const unknownMaterialField = rawFixture();
    (unknownMaterialField.applicationMaterials as Record<string, unknown>)
      .private = "PRIVATE_VALUE";
    expect(() => normalizeGroundedTailoredResume(unknownMaterialField))
      .toThrow(/unsupported field/);
  });

  it("applies normalization between JSON parsing and schema validation with safe observation metadata", async () => {
    const input = rawFixture();
    input.sections[0].type = "PRIVATE_INVALID_TYPE";
    input.sections[0].lines = [claim([
      factIds[0],
      factIds[0],
      factIds[1],
    ])];
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = {
      async record(record) {
        records.push(record);
      },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      id: "provider-id",
      choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify(input) },
      }],
    }), { status: 200 })) as typeof fetch;
    const client = new LLMClient(getAIConfig({
      AI_PROVIDER: "llm_provider",
      LLM_API_KEY: "PRIVATE_API_KEY",
      LLM_MODEL: "test-model",
      LLM_BASE_URL: "https://llm.example.test/v1",
      LLM_RETRY_COUNT: "0",
    }), fetcher, observer);

    const result = await client.structuredCompletion({
      schemaName: "grounded_tailored_resume_result",
      schema: groundedTailoredResumeSchema,
      messages: [{ role: "user", content: "PRIVATE_PROMPT" }],
      normalizeParsedJson: normalizeGroundedTailoredResume,
      allowJsonRepair: false,
    });

    expect(result.metadata.groundedNormalizationSummary).toMatchObject({
      groundedNormalizationApplied: true,
      canonicalizedSectionTypes: 1,
      deduplicatedFactIdCount: 1,
      sourceFactIdLimit: 8,
    });
    expect(records[0].metadata).toMatchObject({
      groundedNormalizationApplied: true,
      canonicalizedSectionTypeCount: 1,
      canonicalizedSectionOrderCount: 0,
      deduplicatedSourceFactIdCount: 1,
      changedSectionsCount: 0,
      maximumChangedSections: 2,
      maximumSourceFactIdsObserved: 2,
      sourceFactIdLimit: 8,
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "passed",
      factualityStatus: "not_reached",
    });
    const observed = JSON.stringify(records);
    expect(observed).not.toContain("PRIVATE_INVALID_TYPE");
    expect(observed).not.toContain("F_SKL_");
    expect(observed).not.toContain("PRIVATE_PROMPT");
    expect(observed).not.toContain("PRIVATE_API_KEY");
  });

  it("retains safe schema diagnostics when required application content is missing", async () => {
    const input = rawFixture();
    input.sections[0].type = "PRIVATE_INVALID_TYPE";
    const materials = input.applicationMaterials as Partial<
      typeof input.applicationMaterials
    >;
    delete materials.selfIntroduction;
    delete materials.applicationEmail;
    delete materials.recruiterMessage;
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = {
      async record(record) {
        records.push(record);
      },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      id: "provider-id",
      choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify(input) },
      }],
    }), { status: 200 })) as typeof fetch;
    const client = new LLMClient(getAIConfig({
      AI_PROVIDER: "llm_provider",
      LLM_API_KEY: "PRIVATE_API_KEY",
      LLM_MODEL: "test-model",
      LLM_BASE_URL: "https://llm.example.test/v1",
      LLM_RETRY_COUNT: "0",
    }), fetcher, observer);

    let caught: unknown;
    try {
      await client.structuredCompletion({
        schemaName: "grounded_tailored_resume_result",
        schema: groundedTailoredResumeSchema,
        messages: [{ role: "user", content: "PRIVATE_PROMPT" }],
        normalizeParsedJson: normalizeGroundedTailoredResume,
        allowJsonRepair: false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: "LLM_SCHEMA_VALIDATION_FAILED",
      groundedNormalizationSummary: {
        canonicalizedSectionTypes: 1,
        defaultedApplicationMaterialArrays: [],
      },
      schemaDiagnosticSummary: {
        issueCount: 3,
      },
    });
    const issuePaths = (
      caught as {
        schemaDiagnosticSummary: { issues: Array<{ path: string }> };
      }
    ).schemaDiagnosticSummary.issues.map((issue) => issue.path);
    expect(issuePaths).toEqual(expect.arrayContaining([
      "applicationMaterials.selfIntroduction",
      "applicationMaterials.applicationEmail",
      "applicationMaterials.recruiterMessage",
    ]));
    expect(records[0].metadata).toMatchObject({
      groundedNormalizationApplied: true,
      defaultedApplicationMaterialArrayCount: 0,
      canonicalizedSectionTypeCount: 1,
      schemaIssueCount: 3,
      changedSectionsCount: 0,
      maximumChangedSections: 2,
      maximumSourceFactIdsObserved: 1,
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "failed",
      factualityStatus: "not_reached",
    });
    const observed = JSON.stringify(records);
    expect(observed).not.toContain("PRIVATE_INVALID_TYPE");
    expect(observed).not.toContain("PRIVATE_PROMPT");
    expect(observed).not.toContain("PRIVATE_API_KEY");
  });

  it("propagates only safe topology diagnostics through the client and observer", async () => {
    const input = rawFixture() as RawFixture & Record<string, unknown>;
    input.PRIVATE_UNKNOWN_ROOT_NAME = {
      nested: "PRIVATE_UNKNOWN_ROOT_VALUE",
    };
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = {
      async record(record) {
        records.push(record);
      },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      id: "provider-id",
      choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify(input) },
      }],
    }), { status: 200 })) as typeof fetch;
    const client = new LLMClient(getAIConfig({
      AI_PROVIDER: "llm_provider",
      LLM_API_KEY: "PRIVATE_API_KEY",
      LLM_MODEL: "test-model",
      LLM_BASE_URL: "https://llm.example.test/v1",
      LLM_RETRY_COUNT: "0",
    }), fetcher, observer);

    let caught: unknown;
    try {
      await client.structuredCompletion({
        schemaName: "grounded_tailored_resume_result",
        schema: groundedTailoredResumeSchema,
        messages: [{ role: "user", content: "PRIVATE_PROMPT" }],
        normalizeParsedJson: normalizeGroundedTailoredResume,
        allowJsonRepair: false,
        allowTransportRetry: false,
        allowFinalizationRetry: false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: "GROUNDED_NORMALIZATION_FAILED",
      message: "Grounded output normalization failed.",
      externalRequestCount: 1,
      groundedNormalizationDiagnosticSummary: {
        diagnosticVersion: 1,
        issueCount: 1,
        truncated: false,
        issues: [
          {
            nodePath: "$",
            category: "UNKNOWN_KEYS_AT_NODE",
            unknownKeyCount: 1,
            unknownValueTypeCounts: { object: 1 },
          },
        ],
      },
    });
    expect(records[0].metadata).toMatchObject({
      normalizationDiagnosticVersion: 1,
      normalizationIssueCount: 1,
      normalizationReportedIssueCount: 1,
      normalizationIssuesTruncated: false,
      normalizationNodePaths: ["$"],
      normalizationIssueCategories: ["UNKNOWN_KEYS_AT_NODE"],
      normalizationUnknownKeyCount: 1,
      normalizationUnknownValueTypeCounts: { object: 1 },
      jsonStatus: "passed",
      normalizationStatus: "failed",
      schemaStatus: "not_reached",
      factualityStatus: "not_reached",
      schemaValidationStatus: "not_reached",
    });
    const observed = JSON.stringify({ caught, records });
    expect(observed).not.toContain("PRIVATE_UNKNOWN_ROOT_NAME");
    expect(observed).not.toContain("PRIVATE_UNKNOWN_ROOT_VALUE");
    expect(observed).not.toContain("nested");
    expect(observed).not.toContain("PRIVATE_PROMPT");
    expect(observed).not.toContain("PRIVATE_API_KEY");
  });

  it("documents the three required paths without defaulting them", () => {
    expect(REQUIRED_APPLICATION_MATERIAL_PATHS).toEqual([
      "applicationMaterials.selfIntroduction",
      "applicationMaterials.applicationEmail",
      "applicationMaterials.recruiterMessage",
    ]);
  });
});
