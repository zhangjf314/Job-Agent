import type { TailoredResumeResult } from "@/types/jd";
import type { JDAnalysisResult } from "@/types/jd";
import type { ResumeProfile } from "@/services/resume-generator";
import { generateTailoredResumeContent } from "@/services/tailored-resume-generator";
import {
  LLMClient,
  type LLMCompletionMetadata,
  type LLMResponseSafetySummary,
} from "./llm-client";
import {
  buildCandidateFactRegistry,
  buildJobRequirementFacts,
  formatFactRegistryForPrompt,
  formatJobRequirementsForPrompt,
  type CandidateFact,
  type JobRequirementFact,
} from "./candidate-fact-registry";
import {
  groundedTailoredResumeOutputContract,
  groundedTailoredResumeSchema,
  stripGroundingMetadata,
  type GroundedTailoredResume,
} from "./tailored-resume-grounding";
import {
  evaluateTailoredResumeFactuality,
  TailoredResumeFactualityError,
  type FactualityReport,
  type FactualityStatus,
} from "./tailored-resume-factuality";
import {
  GROUNDED_SOURCE_FACT_ID_LIMIT,
  GROUNDED_TAILORED_RESUME_LIMITS,
  normalizeGroundedTailoredResume,
} from "./tailored-resume-grounded-normalizer";

export type TailoredResumeWriterInput = {
  profile: ResumeProfile;
  baseResumeMarkdown: string;
  jdAnalysis: JDAnalysisResult;
  requestPolicy?: {
    allowTransportRetry?: boolean;
    allowJsonRepair?: boolean;
    allowFactualityRepair?: boolean;
    allowFinalizationRetry?: boolean;
  };
};

export type TailoredResumeDiagnostics = {
  factualityStatus: FactualityStatus;
  factualityViolationCount: number;
  factualityViolationCategories: string[];
  factualityRepairCount: number;
  groundedClaimCount: number;
  ungroundedClaimCount: number;
  unknownFactIds: number;
  missingSourceIds: number;
  transportRetryCount: number;
  jsonRepairCount: number;
  finalizationRetryCount: number;
  externalRequestCount: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningFieldPresent: boolean;
  groundedNormalizationApplied: boolean;
  defaultedApplicationMaterialArrayCount: number;
  defaultedApplicationMaterialPaths: string[];
  canonicalizedSectionTypeCount: number;
  canonicalizedSectionOrderCount: number;
  deduplicatedSourceFactIdCount: number;
  changedSectionsCount: number | null;
  maximumChangedSections: number;
  maximumSourceFactIdsObserved: number | null;
  sourceFactIdLimit: number;
  httpStatus?: number;
  responseSafetySummary?: LLMResponseSafetySummary;
};

export type TailoredResumeWriterOutput = {
  result: TailoredResumeResult;
  diagnostics: TailoredResumeDiagnostics;
};

export interface TailoredResumeWriterProvider {
  write(input: TailoredResumeWriterInput): Promise<TailoredResumeWriterOutput>;
}

export class MockTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
  async write(input: TailoredResumeWriterInput): Promise<TailoredResumeWriterOutput> {
    return {
      result: generateTailoredResumeContent(
        input.profile,
        { contentMarkdown: input.baseResumeMarkdown },
        input.jdAnalysis,
      ),
      diagnostics: {
        factualityStatus: "pass",
        factualityViolationCount: 0,
        factualityViolationCategories: [],
        factualityRepairCount: 0,
        groundedClaimCount: 0,
        ungroundedClaimCount: 0,
        unknownFactIds: 0,
        missingSourceIds: 0,
        transportRetryCount: 0,
        jsonRepairCount: 0,
        finalizationRetryCount: 0,
        externalRequestCount: 0,
        latencyMs: 0,
        reasoningFieldPresent: false,
        groundedNormalizationApplied: false,
        defaultedApplicationMaterialArrayCount: 0,
        defaultedApplicationMaterialPaths: [],
        canonicalizedSectionTypeCount: 0,
        canonicalizedSectionOrderCount: 0,
        deduplicatedSourceFactIdCount: 0,
        changedSectionsCount: 0,
        maximumChangedSections:
          GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
        maximumSourceFactIdsObserved: 0,
        sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
        httpStatus: undefined,
      },
    };
  }
}

function add(valueA?: number, valueB?: number) {
  if (valueA === undefined && valueB === undefined) return undefined;
  return (valueA ?? 0) + (valueB ?? 0);
}

type GroundedCompletion = {
  data: GroundedTailoredResume;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  metadata: LLMCompletionMetadata;
};

function diagnostics(
  report: FactualityReport,
  initial: GroundedCompletion,
  repaired?: GroundedCompletion,
): TailoredResumeDiagnostics {
  const normalizationSummaries = [
    initial.metadata.groundedNormalizationSummary,
    repaired?.metadata.groundedNormalizationSummary,
  ].filter((summary) => summary !== undefined);
  return {
    factualityStatus: report.status,
    factualityViolationCount: report.violations.length,
    factualityViolationCategories: [...new Set(report.violations.map((item) => item.category))],
    factualityRepairCount: repaired ? 1 : 0,
    groundedClaimCount: report.groundedClaimCount,
    ungroundedClaimCount: report.ungroundedClaimCount,
    unknownFactIds: report.unknownFactIds,
    missingSourceIds: report.missingSourceIds,
    transportRetryCount: initial.metadata.retryCount + (repaired?.metadata.retryCount ?? 0),
    jsonRepairCount: initial.metadata.repairCount + (repaired?.metadata.repairCount ?? 0),
    finalizationRetryCount:
      (initial.metadata.finalizationRetryCount ?? 0) +
      (repaired?.metadata.finalizationRetryCount ?? 0),
    externalRequestCount:
      initial.metadata.externalRequestCount + (repaired?.metadata.externalRequestCount ?? 0),
    latencyMs: initial.metadata.latencyMs + (repaired?.metadata.latencyMs ?? 0),
    inputTokens: add(initial.usage?.prompt_tokens, repaired?.usage?.prompt_tokens),
    outputTokens: add(initial.usage?.completion_tokens, repaired?.usage?.completion_tokens),
    totalTokens: add(initial.usage?.total_tokens, repaired?.usage?.total_tokens),
    reasoningFieldPresent:
      initial.metadata.reasoningFieldPresent || (repaired?.metadata.reasoningFieldPresent ?? false),
    groundedNormalizationApplied: normalizationSummaries.some(
      (summary) => summary.groundedNormalizationApplied,
    ),
    defaultedApplicationMaterialArrayCount: normalizationSummaries.reduce(
      (total, summary) =>
        total + summary.defaultedApplicationMaterialArrays.length,
      0,
    ),
    defaultedApplicationMaterialPaths: [
      ...new Set(
        normalizationSummaries.flatMap(
          (summary) => summary.defaultedApplicationMaterialArrays,
        ),
      ),
    ],
    canonicalizedSectionTypeCount: normalizationSummaries.reduce(
      (total, summary) => total + summary.canonicalizedSectionTypes,
      0,
    ),
    canonicalizedSectionOrderCount: normalizationSummaries.reduce(
      (total, summary) => total + summary.canonicalizedSectionOrders,
      0,
    ),
    deduplicatedSourceFactIdCount: normalizationSummaries.reduce(
      (total, summary) => total + summary.deduplicatedFactIdCount,
      0,
    ),
    changedSectionsCount:
      repaired?.metadata.groundedNormalizationSummary?.changedSectionsCount ??
      initial.metadata.groundedNormalizationSummary?.changedSectionsCount ??
      null,
    maximumChangedSections:
      repaired?.metadata.groundedNormalizationSummary?.changedSectionsLimit ??
      initial.metadata.groundedNormalizationSummary?.changedSectionsLimit ??
      GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
    maximumSourceFactIdsObserved:
      repaired?.metadata.groundedNormalizationSummary
        ?.maximumSourceFactIdsObserved ??
      initial.metadata.groundedNormalizationSummary
        ?.maximumSourceFactIdsObserved ??
      null,
    sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
    httpStatus: repaired?.metadata.httpStatus ?? initial.metadata.httpStatus,
    responseSafetySummary:
      repaired?.metadata.responseSafetySummary ?? initial.metadata.responseSafetySummary,
  };
}

const finalizationInstruction = [
  "Return only the final JSON object.",
  "Do not output analysis, explanation, Markdown, or prose.",
  "Use only the supplied candidate fact IDs.",
  "Do not repeat the instructions.",
  "Keep every text field within the declared limits.",
].join("\n");

export function buildGroundedTailoredResumeMessages(
  candidateFacts: CandidateFact[],
  jobRequirements: JobRequirementFact[],
  finalization = false,
) {
  return [
    {
      role: "system" as const,
      content: [
        "Create a concise Chinese tailored resume with internal candidate-fact citations.",
        "Only CANDIDATE_FACTS prove existing capabilities or experience; JOB_REQUIREMENTS are targets, never candidate evidence.",
        "Never invent employers, internships, awards, certificates, skills, AI/LLM/API projects, metrics, achievements, or stronger capability levels.",
        "Goals, learning plans, and transferable foundations must remain explicitly future-oriented.",
        finalization ? finalizationInstruction : "",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "CANDIDATE_FACTS",
        formatFactRegistryForPrompt(candidateFacts),
        "",
        "JOB_REQUIREMENTS_ONLY",
        formatJobRequirementsForPrompt(jobRequirements),
      ].join("\n"),
    },
  ];
}

export class LLMTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
  constructor(
    private readonly client = new LLMClient(),
    private readonly _fallback = new MockTailoredResumeWriterProvider(),
    private readonly _fallbackEnabled = false,
  ) {}

  async write(input: TailoredResumeWriterInput): Promise<TailoredResumeWriterOutput> {
    const candidateFacts = buildCandidateFactRegistry(input.profile, input.baseResumeMarkdown);
    const jobRequirements = buildJobRequirementFacts(input.jdAnalysis, candidateFacts);
    const startedAt = Date.now();
    try {
      const initial = await this.client.structuredCompletion({
        schemaName: "grounded_tailored_resume_result",
        schema: groundedTailoredResumeSchema,
        normalizeParsedJson: normalizeGroundedTailoredResume,
        outputContract: groundedTailoredResumeOutputContract,
        messages: buildGroundedTailoredResumeMessages(candidateFacts, jobRequirements),
        finalizationRetryMessages:
          buildGroundedTailoredResumeMessages(candidateFacts, jobRequirements, true),
        allowTransportRetry: input.requestPolicy?.allowTransportRetry,
        allowJsonRepair: input.requestPolicy?.allowJsonRepair,
        allowFinalizationRetry: input.requestPolicy?.allowFinalizationRetry,
      });
      let grounded = groundedTailoredResumeSchema.parse(initial.data);
      let report = evaluateTailoredResumeFactuality(grounded, candidateFacts, jobRequirements);
      let repaired: GroundedCompletion | undefined;

      if (
        report.status !== "pass" &&
        input.requestPolicy?.allowFactualityRepair !== false
      ) {
        repaired = await this.client.structuredCompletion({
          schemaName: "grounded_tailored_resume_factuality_repair",
          schema: groundedTailoredResumeSchema,
          normalizeParsedJson: normalizeGroundedTailoredResume,
          outputContract: groundedTailoredResumeOutputContract,
          allowTransportRetry: input.requestPolicy?.allowTransportRetry,
          allowJsonRepair: input.requestPolicy?.allowJsonRepair,
          allowFinalizationRetry: false,
          messages: [
            {
              role: "system",
              content: [
                "Remove or conservatively rewrite unsupported candidate claims.",
                "Do not add facts, explanations, fields, or content.",
                "Use only the allowed F_* IDs already present in the supplied allowed list.",
                "Keep the same compact schema, array limits, and text limits. Return JSON only.",
              ].join("\n"),
            },
            {
              role: "user",
              content: JSON.stringify({
                currentStructuredResult: grounded,
                allowedCandidateFactIds: candidateFacts.map((fact) => fact.id),
                violations: report.violations.map((item) => ({
                  category: item.category,
                  path: item.path,
                  safeSummary: item.safeSummary,
                })),
              }),
            },
          ],
        });
        grounded = groundedTailoredResumeSchema.parse(repaired.data);
        report = evaluateTailoredResumeFactuality(grounded, candidateFacts, jobRequirements);
      }

      const finalDiagnostics = diagnostics(report, initial, repaired);
      await this.client.recordSafeObservation({
        operation: "tailored_resume_result",
        provider: "llm_provider",
        model: initial.metadata.model,
        status: report.status === "pass" ? "success" : "failed",
        durationMs: Date.now() - startedAt,
        promptTokens: finalDiagnostics.inputTokens,
        completionTokens: finalDiagnostics.outputTokens,
        totalTokens: finalDiagnostics.totalTokens,
        errorCode: report.status === "pass" ? undefined : "TAILORED_RESUME_FACTUALITY_VIOLATION",
        fallbackUsed: false,
        metadata: {
          requestId: initial.metadata.requestId,
          providerRequested: "llm_provider",
          providerUsed: "llm_provider",
          factualityStatus: report.status,
          factualityViolationCount: report.violations.length,
          factualityViolationCategories: finalDiagnostics.factualityViolationCategories,
          factualityRepairCount: finalDiagnostics.factualityRepairCount,
          groundedClaimCount: report.groundedClaimCount,
          ungroundedClaimCount: report.ungroundedClaimCount,
          unknownFactIds: report.unknownFactIds,
          missingSourceIds: report.missingSourceIds,
          transportRetryCount: finalDiagnostics.transportRetryCount,
          jsonRepairCount: finalDiagnostics.jsonRepairCount,
          finalizationRetryCount: finalDiagnostics.finalizationRetryCount,
          externalRequestCount: finalDiagnostics.externalRequestCount,
          reasoningFieldPresent: finalDiagnostics.reasoningFieldPresent,
          groundedNormalizationApplied:
            finalDiagnostics.groundedNormalizationApplied,
          defaultedApplicationMaterialArrayCount:
            finalDiagnostics.defaultedApplicationMaterialArrayCount,
          defaultedApplicationMaterialPaths:
            finalDiagnostics.defaultedApplicationMaterialPaths,
          canonicalizedSectionTypeCount:
            finalDiagnostics.canonicalizedSectionTypeCount,
          canonicalizedSectionOrderCount:
            finalDiagnostics.canonicalizedSectionOrderCount,
          deduplicatedSourceFactIdCount:
            finalDiagnostics.deduplicatedSourceFactIdCount,
          changedSectionsCount: finalDiagnostics.changedSectionsCount,
          maximumChangedSections: finalDiagnostics.maximumChangedSections,
          maximumSourceFactIdsObserved:
            finalDiagnostics.maximumSourceFactIdsObserved,
          sourceFactIdLimit: finalDiagnostics.sourceFactIdLimit,
          httpStatus: finalDiagnostics.httpStatus,
          jsonStatus: "passed",
          normalizationStatus: "passed",
          schemaStatus: "passed",
          groundedSchemaStatus: "passed",
        },
      });
      if (report.status !== "pass") {
        const failure = new TailoredResumeFactualityError(report);
        failure.diagnostics = finalDiagnostics;
        throw failure;
      }
      return {
        result: stripGroundingMetadata(grounded),
        diagnostics: finalDiagnostics,
      };
    } catch (error) {
      if (error instanceof TailoredResumeFactualityError) throw error;
      // A provider or grounding failure must never become a successful-looking
      // tailored resume through Mock fallback.
      throw error;
    }
  }
}
