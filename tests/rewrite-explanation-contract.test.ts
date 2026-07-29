import { describe, expect, it, vi } from "vitest";
import {
  buildRewriteExplanationOutputContract,
  classifyGroundedSchemaFailure,
  GROUNDED_SECTION_TYPES_BY_POSITION,
  GROUNDED_TAILORED_RESUME_LIMITS,
  GROUNDED_TOP_LEVEL_CONTRACT,
  rewriteExplanationReceivedType,
} from "@/services/ai/grounded-tailored-resume-contract";
import {
  groundedTailoredResumeOutputContract,
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
  type GroundedTailoredResume,
} from "@/services/ai/tailored-resume-grounding";
import {
  normalizeGroundedTailoredResume,
  safeGroundedNormalizationMetadata,
} from "@/services/ai/tailored-resume-grounded-normalizer";
import {
  evaluateTailoredResumeFactuality,
  TailoredResumeFactualityError,
} from "@/services/ai/tailored-resume-factuality";
import {
  LLMClient,
} from "@/services/ai/llm-client";
import type {
  LLMCallObserver,
} from "@/services/ai/llm-observability";
import {
  LLMTailoredResumeWriterProvider,
} from "@/services/ai/tailored-resume-writer";
import { getAIConfig } from "@/lib/ai-config";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeProfile,
} from "@/scripts/llm-smoke-fixtures";

function goalLine() {
  return {
    text: "计划继续完善求职材料",
    sourceFactIds: [] as string[],
    kind: "goal" as const,
  };
}

function fixture(rewriteExplanation: unknown = [
  "突出与虚构岗位相关的已有事实",
]) {
  return {
    sections: GROUNDED_SECTION_TYPES_BY_POSITION.map((type, order) => ({
      type,
      title: `section-${order}`,
      lines: [goalLine()],
      order,
    })),
    rewriteExplanation,
    changedSections: [
      ...GROUNDED_SECTION_TYPES_BY_POSITION.slice(
        0,
        GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
      ),
    ],
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

function completionMetadata() {
  return {
    requestId: "test",
    model: "test-model",
    latencyMs: 1,
    retryCount: 0,
    repairCount: 0,
    finalizationRetryCount: 0,
    externalRequestCount: 1,
    reasoningFieldPresent: false,
    thinkingModeRequested: "disabled" as const,
    groundedNormalizationSummary: {
      groundedNormalizationApplied: false,
      defaultedApplicationMaterialArrays: [],
      canonicalizedSectionTypes: 0,
      canonicalizedSectionOrders: 0,
      deduplicatedFactIdCount: 0,
      rewriteExplanationCount: 1,
      rewriteExplanationLimit:
        GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax,
      rewriteExplanationReceivedType: "array" as const,
      changedSectionsCount: 2,
      maximumSourceFactIdsObserved: 0,
      changedSectionsLimit:
        GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
      sourceFactIdLimit:
        GROUNDED_TAILORED_RESUME_LIMITS.sourceFactIdsMax,
    },
    httpStatus: 200,
    jsonStatus: "passed" as const,
    normalizationStatus: "passed" as const,
    schemaStatus: "passed" as const,
    factualityStatus: "not_reached" as const,
    schemaValidationStatus: "passed" as const,
    responseSafetySummary: {
      responseId: "test-response",
      choiceCount: 1,
      firstChoicePresent: true,
      messagePresent: true,
      contentState: "present" as const,
      contentCharacterLength: 1,
      contentByteLength: 1,
      finishReason: "stop",
      reasoningFieldPresent: false,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      outputLimitReached: false,
    },
  };
}

describe("rewriteExplanation strict contract", () => {
  it("shares the existing schema limits without inventing an item maximum", () => {
    expect(GROUNDED_TOP_LEVEL_CONTRACT.rewriteExplanation).toEqual({
      type: "string_array",
      minItems: 0,
      maxItems: 2,
      itemMinChars: 1,
      itemMaxChars: null,
    });
    expect(GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax).toBe(2);
    expect(
      GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationItemMinChars,
    ).toBe(1);
  });

  it.each([1, 2])("accepts a %i-item string array", (count) => {
    const input = fixture(
      Array.from({ length: count }, (_, index) => `说明-${index}`),
    );
    expect(groundedTailoredResumeSchema.safeParse(input).success).toBe(true);
  });

  it("keeps the existing empty-array behavior", () => {
    expect(groundedTailoredResumeSchema.safeParse(fixture([])).success)
      .toBe(true);
  });

  it("rejects three items", () => {
    expect(
      groundedTailoredResumeSchema.safeParse(
        fixture(["说明一", "说明二", "说明三"]),
      ).success,
    ).toBe(false);
  });

  it.each([
    ["single string", "PRIVATE_EXPLANATION"],
    ["null", null],
    ["object", { text: "PRIVATE_EXPLANATION" }],
    ["number", 42],
  ])("rejects %s", (_name, value) => {
    expect(groundedTailoredResumeSchema.safeParse(fixture(value)).success)
      .toBe(false);
  });

  it("rejects empty string elements and a missing field", () => {
    expect(groundedTailoredResumeSchema.safeParse(fixture(["  "])).success)
      .toBe(false);
    const missing = fixture() as Record<string, unknown>;
    delete missing.rewriteExplanation;
    expect(groundedTailoredResumeSchema.safeParse(missing).success).toBe(false);
  });

  it("does not add an arbitrary item-length rejection", () => {
    const longButFinite = "说明".repeat(2_000);
    expect(
      groundedTailoredResumeSchema.safeParse(fixture([longButFinite])).success,
    ).toBe(true);
  });

  it("states array, strings, limit, prohibition, and one array example", () => {
    const contract = buildRewriteExplanationOutputContract();
    expect(contract).toContain("must be a JSON array of strings");
    expect(contract).toContain("at most 2 items");
    expect(contract).toContain("never a single string");
    expect(contract).toContain('"rewriteExplanation":[');
    expect(contract).not.toMatch(/"rewriteExplanation"\s*:\s*"/);
    expect(groundedTailoredResumeOutputContract.split(contract)).toHaveLength(2);
  });

  it("passes the same authoritative contract to factuality repair", async () => {
    const invalid = fixture() as GroundedTailoredResume;
    invalid.sections[0].lines = [{
      text: "不存在事实来源的声明",
      sourceFactIds: [],
      kind: "fact",
    }];
    const fakeClient = {
      structuredCompletion: vi.fn()
        .mockResolvedValueOnce({
          data: invalid,
          usage: {},
          metadata: completionMetadata(),
        })
        .mockResolvedValueOnce({
          data: invalid,
          usage: {},
          metadata: completionMetadata(),
        }),
      recordSafeObservation: vi.fn(),
    } as unknown as LLMClient;
    const provider = new LLMTailoredResumeWriterProvider(fakeClient);

    await expect(provider.write({
      profile: fictionalSmokeProfile,
      baseResumeMarkdown: fictionalSmokeBaseResume,
      jdAnalysis: fictionalSmokeJD,
      requestPolicy: { allowFactualityRepair: true },
    })).rejects.toBeInstanceOf(TailoredResumeFactualityError);

    const calls = vi.mocked(fakeClient.structuredCompletion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].outputContract).toBe(
      groundedTailoredResumeOutputContract,
    );
    expect(calls[1][0].outputContract).toBe(
      groundedTailoredResumeOutputContract,
    );
    expect(JSON.stringify(calls[1][0].messages)).not.toContain(
      "must be a JSON array of strings",
    );
  });

  it("never wraps, splits, or converts a string locally", () => {
    const input = fixture("PRIVATE_EXPLANATION");
    const normalized = normalizeGroundedTailoredResume(input);
    expect(
      (normalized.normalized as typeof input).rewriteExplanation,
    ).toBe("PRIVATE_EXPLANATION");
    expect(normalized.summary).toMatchObject({
      rewriteExplanationReceivedType: "string",
      rewriteExplanationCount: null,
      rewriteExplanationLimit: 2,
    });
    expect(groundedTailoredResumeSchema.safeParse(normalized.normalized).success)
      .toBe(false);
    expect(() => stripGroundingMetadata(
      normalized.normalized as GroundedTailoredResume,
    )).toThrow();
  });

  it.each([
    [[], "array"],
    ["text", "string"],
    [null, "null"],
    [{}, "object"],
    [1, "other"],
  ] as const)("records only safe received type for %j", (value, expected) => {
    expect(rewriteExplanationReceivedType(value)).toBe(expected);
  });

  it("stores type and null count without storing invalid text", async () => {
    const input = fixture("PRIVATE_EXPLANATION_TEXT");
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

    await expect(client.structuredCompletion({
      schemaName: "grounded_tailored_resume_result",
      schema: groundedTailoredResumeSchema,
      normalizeParsedJson: normalizeGroundedTailoredResume,
      messages: [{ role: "user", content: "PRIVATE_PROMPT" }],
      allowTransportRetry: false,
      allowFinalizationRetry: false,
      allowJsonRepair: false,
    })).rejects.toMatchObject({
      code: "LLM_SCHEMA_VALIDATION_FAILED",
      groundedNormalizationSummary: {
        rewriteExplanationReceivedType: "string",
        rewriteExplanationCount: null,
        rewriteExplanationLimit: 2,
      },
    });

    expect(records[0].metadata).toMatchObject({
      jsonStatus: "passed",
      normalizationStatus: "passed",
      schemaStatus: "failed",
      factualityStatus: "not_reached",
      rewriteExplanationReceivedType: "string",
      rewriteExplanationCount: null,
      rewriteExplanationLimit: 2,
      schemaBusinessErrorCategory:
        "REWRITE_EXPLANATION_TYPE_VIOLATION",
    });
    const observed = JSON.stringify(records);
    expect(observed).not.toContain("PRIVATE_EXPLANATION_TEXT");
    expect(observed).not.toContain("PRIVATE_PROMPT");
    expect(observed).not.toContain("PRIVATE_API_KEY");
  });

  it("stores an array count and limit without array values", () => {
    const normalized = normalizeGroundedTailoredResume(
      fixture(["PRIVATE_FIRST", "PRIVATE_SECOND"]),
    );
    const metadata = safeGroundedNormalizationMetadata(normalized.summary);
    expect(metadata).toMatchObject({
      rewriteExplanationReceivedType: "array",
      rewriteExplanationCount: 2,
      rewriteExplanationLimit: 2,
    });
    const observed = JSON.stringify(metadata);
    expect(observed).not.toContain("PRIVATE_FIRST");
    expect(observed).not.toContain("PRIVATE_SECOND");
  });

  it("does not over-classify failures with additional schema issues", () => {
    expect(classifyGroundedSchemaFailure(
      "grounded_tailored_resume_result",
      {
        schemaName: "grounded_tailored_resume_result",
        issueCount: 2,
        reportedIssueCount: 2,
        truncated: false,
        issues: [],
      },
    )).toBeUndefined();
  });

  it("classifies only an isolated rewriteExplanation cardinality issue", () => {
    expect(classifyGroundedSchemaFailure(
      "grounded_tailored_resume_result",
      {
        schemaName: "grounded_tailored_resume_result",
        issueCount: 1,
        reportedIssueCount: 1,
        truncated: false,
        issues: [{
          category: "ARRAY_TOO_LARGE",
          path: "rewriteExplanation",
          expectedType: "array",
          receivedType: "array",
          minimum: null,
          maximum: 2,
          actualSize: 3,
          unknownKeyCount: null,
        }],
      },
    )).toBe("REWRITE_EXPLANATION_CARDINALITY_VIOLATION");
  });

  it("passes normalization, schema, factuality, and public conversion", () => {
    const normalized = normalizeGroundedTailoredResume(
      fixture(["说明一", "说明二"]),
    );
    const grounded = groundedTailoredResumeSchema.parse(normalized.normalized);
    const report = evaluateTailoredResumeFactuality(grounded, [], []);
    const publicResult = stripGroundingMetadata(grounded);
    expect(normalized.summary).toMatchObject({
      rewriteExplanationReceivedType: "array",
      rewriteExplanationCount: 2,
      rewriteExplanationLimit: 2,
    });
    expect(report.status).toBe("pass");
    expect(publicResult.rewriteExplanation).toHaveLength(2);
    expect(publicResult.sections).toHaveLength(6);
  });
});
