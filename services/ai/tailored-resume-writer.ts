import type { TailoredResumeResult } from "@/types/jd";
import type { JDAnalysisResult } from "@/types/jd";
import type { ResumeProfile } from "@/services/resume-generator";
import { ZodError } from "zod";
import { generateTailoredResumeContent } from "@/services/tailored-resume-generator";
import {
  LLMClient,
  LLMClientError,
  type LLMCompletionMetadata,
  type LLMResponseSafetySummary,
} from "./llm-client";
import {
  buildCandidateFactRegistry,
  buildCandidateFactRenderDescriptors,
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
import type {
  RewriteExplanationReceivedType,
} from "./grounded-tailored-resume-contract";
import {
  applyFactualityRepairPatch,
  buildFactualityRepairMessages,
  buildFactualityRepairOutputContract,
  buildFactualityRepairTargets,
  classifyFactualityRepairOutcome,
  factualityRepairPatchSchema,
  FactualityRepairError,
  summarizeFactualityRepair,
  validateFactualityRepairPatch,
  type FactualityRepairErrorCode,
  type FactualityRepairPatch,
  type FactualityRepairSummary,
  type FactualityRepairTarget,
} from "./tailored-resume-factuality-repair";
import {
  createEmptyFactualityRepairDiagnostics,
  diagnoseFactualityRepairPatch,
  markPostRepairFactuality,
  markPostRepairSchemaFailure,
  markRepairApplicationPassed,
  markRepairEnvelopeFailure,
  markRepairJsonFailure,
  markRepairScopeFailure,
  type FactualityRepairDiagnostics,
} from "./factuality-repair-diagnostics";
import {
  buildTailoredResumePlanMessages,
  tailoredResumePlanOutputContract,
  tailoredResumePlanSchema,
} from "./tailored-resume-plan";
import {
  TailoredResumePlanError,
  validateTailoredResumePlan,
} from "./tailored-resume-plan-validator";
import {
  compileGroundedTailoredResume,
  DeterministicGroundedCompilerError,
  type GroundedCompilerDiagnostics,
} from "./tailored-resume-grounded-compiler";
import type { PipelineStageStatus } from "./pipeline-stage-status";

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
  planJsonStatus: PipelineStageStatus;
  planSchemaStatus: PipelineStageStatus;
  planValidationStatus: PipelineStageStatus;
  compilerStatus: PipelineStageStatus;
  selectedFactCount: number;
  renderedFactCount: number;
  omittedFactCount: number;
  unrenderableFactCount: number;
  sectionFactSelectionCounts: number[];
  compilerSectionLineCounts: number[];
  compilerMaximumLineLength: number;
  compilerMaximumSourceFactIds: number;
  applicationMaterialLineCounts: number[];
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
  rewriteExplanationReceivedType: RewriteExplanationReceivedType;
  rewriteExplanationCount: number | null;
  rewriteExplanationLimit: number;
  changedSectionsCount: number | null;
  maximumChangedSections: number;
  maximumSourceFactIdsObserved: number | null;
  sourceFactIdLimit: number;
  sectionCount: number | null;
  sectionLinesLimit: number;
  sectionLineCounts: number[];
  maximumSectionLinesObserved: number | null;
  sectionLineCardinalityViolationCount: number;
  sectionLineCardinalityViolationPaths: string[];
  skillsSectionLineCount: number | null;
  factualityViolationCountBeforeRepair: number;
  factualityRepairTargetCount: number;
  factualityRepairPatchCount: number;
  factualityRepairApplied: boolean;
  factualityViolationCountAfterRepair: number;
  factualityViolationsResolved: number;
  factualityViolationsIntroduced: number;
  factualityRepairRemainingCategories: string[];
  factualityRepairScopeViolation: boolean;
  factualityRepairTargetPaths: string[];
  factualityRepairTargetCategories: string[];
  factualityRepairFailureCategory?: FactualityRepairErrorCode;
  httpStatus?: number;
  responseSafetySummary?: LLMResponseSafetySummary;
} & FactualityRepairDiagnostics;

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
        planJsonStatus: "not_reached",
        planSchemaStatus: "not_reached",
        planValidationStatus: "not_reached",
        compilerStatus: "not_reached",
        selectedFactCount: 0,
        renderedFactCount: 0,
        omittedFactCount: 0,
        unrenderableFactCount: 0,
        sectionFactSelectionCounts: [],
        compilerSectionLineCounts: [],
        compilerMaximumLineLength: 0,
        compilerMaximumSourceFactIds: 0,
        applicationMaterialLineCounts: [],
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
        rewriteExplanationReceivedType: "other",
        rewriteExplanationCount: null,
        rewriteExplanationLimit:
          GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax,
        changedSectionsCount: 0,
        maximumChangedSections:
          GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
        maximumSourceFactIdsObserved: 0,
        sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
        sectionCount: 0,
        sectionLinesLimit:
          GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax,
        sectionLineCounts: [],
        maximumSectionLinesObserved: 0,
        sectionLineCardinalityViolationCount: 0,
        sectionLineCardinalityViolationPaths: [],
        skillsSectionLineCount: null,
        factualityViolationCountBeforeRepair: 0,
        factualityRepairTargetCount: 0,
        factualityRepairPatchCount: 0,
        factualityRepairApplied: false,
        factualityViolationCountAfterRepair: 0,
        factualityViolationsResolved: 0,
        factualityViolationsIntroduced: 0,
        factualityRepairRemainingCategories: [],
        factualityRepairScopeViolation: false,
        factualityRepairTargetPaths: [],
        factualityRepairTargetCategories: [],
        ...createEmptyFactualityRepairDiagnostics(0),
        httpStatus: undefined,
      },
    };
  }
}

function add(valueA?: number, valueB?: number) {
  if (valueA === undefined && valueB === undefined) return undefined;
  return (valueA ?? 0) + (valueB ?? 0);
}

type Completion<T> = {
  data: T;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  metadata: LLMCompletionMetadata;
};

type GroundedCompletion = Completion<GroundedTailoredResume>;
type RepairCompletion = Completion<FactualityRepairPatch>;

function emptyRepairSummary(report: FactualityReport): FactualityRepairSummary {
  return {
    factualityViolationCountBeforeRepair: report.violations.length,
    factualityRepairTargetCount: 0,
    factualityRepairPatchCount: 0,
    factualityRepairApplied: false,
    factualityViolationCountAfterRepair: report.violations.length,
    factualityViolationsResolved: 0,
    factualityViolationsIntroduced: 0,
    factualityRepairRemainingCategories: [
      ...new Set(report.violations.map((item) => item.category)),
    ].sort(),
    factualityRepairScopeViolation: false,
    factualityRepairTargetPaths: [],
    factualityRepairTargetCategories: [],
  };
}

function repairDiagnosticErrorCode(
  diagnostics: FactualityRepairDiagnostics,
): FactualityRepairErrorCode {
  if (diagnostics.repairDuplicateTargetIds.length > 0) {
    return "FACTUALITY_REPAIR_TARGET_DUPLICATED";
  }
  if (diagnostics.repairUnknownTargetCount > 0) {
    return "FACTUALITY_REPAIR_TARGET_UNKNOWN";
  }
  if (diagnostics.repairMissingTargetIds.length > 0) {
    return "FACTUALITY_REPAIR_TARGET_MISSING";
  }
  return "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID";
}

function repairCompletionFromError(
  error: LLMClientError,
  initial: GroundedCompletion,
): RepairCompletion {
  return {
    data: { repairs: [] },
    usage: error.usage,
    metadata: {
      requestId: error.requestId ?? initial.metadata.requestId,
      model: initial.metadata.model,
      latencyMs: error.latencyMs ?? 0,
      retryCount: error.retryCount,
      repairCount: error.repairCount,
      finalizationRetryCount: error.finalizationRetryCount,
      externalRequestCount: error.externalRequestCount,
      reasoningFieldPresent:
        error.responseSummary?.reasoningFieldPresent ?? false,
      thinkingModeRequested: initial.metadata.thinkingModeRequested,
      httpStatus: error.httpStatus,
      jsonStatus:
        error.code === "LLM_STRUCTURED_OUTPUT_INVALID" ? "failed" : "passed",
      normalizationStatus: "not_reached",
      schemaStatus:
        error.code === "LLM_SCHEMA_VALIDATION_FAILED"
          ? "failed"
          : "not_reached",
      factualityStatus: "not_reached",
      schemaValidationStatus:
        error.code === "LLM_SCHEMA_VALIDATION_FAILED"
          ? "failed"
          : "not_reached",
      responseSafetySummary:
        error.responseSummary ?? initial.metadata.responseSafetySummary,
    },
  };
}

function diagnostics(
  report: FactualityReport,
  initial: GroundedCompletion,
  repaired: RepairCompletion | undefined,
  repairSummary: FactualityRepairSummary,
  repairDiagnostics: FactualityRepairDiagnostics,
): TailoredResumeDiagnostics {
  const normalizationSummaries = [
    initial.metadata.groundedNormalizationSummary,
  ].filter((summary) => summary !== undefined);
  return {
    planJsonStatus: "not_reached",
    planSchemaStatus: "not_reached",
    planValidationStatus: "not_reached",
    compilerStatus: "not_reached",
    selectedFactCount: 0,
    renderedFactCount: 0,
    omittedFactCount: 0,
    unrenderableFactCount: 0,
    sectionFactSelectionCounts: [],
    compilerSectionLineCounts: [],
    compilerMaximumLineLength: 0,
    compilerMaximumSourceFactIds: 0,
    applicationMaterialLineCounts: [],
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
    rewriteExplanationReceivedType:
      repaired?.metadata.groundedNormalizationSummary
        ?.rewriteExplanationReceivedType ??
      initial.metadata.groundedNormalizationSummary
        ?.rewriteExplanationReceivedType ??
      "other",
    rewriteExplanationCount:
      repaired?.metadata.groundedNormalizationSummary
        ?.rewriteExplanationCount ??
      initial.metadata.groundedNormalizationSummary
        ?.rewriteExplanationCount ??
      null,
    rewriteExplanationLimit:
      repaired?.metadata.groundedNormalizationSummary
        ?.rewriteExplanationLimit ??
      initial.metadata.groundedNormalizationSummary
        ?.rewriteExplanationLimit ??
      GROUNDED_TAILORED_RESUME_LIMITS.rewriteExplanationMax,
    changedSectionsCount:
      repaired?.metadata.groundedNormalizationSummary?.changedSectionsCount ??
      initial.metadata.groundedNormalizationSummary?.changedSectionsCount ??
      null,
    maximumChangedSections:
      repaired?.metadata.groundedNormalizationSummary?.changedSectionsLimit ??
      initial.metadata.groundedNormalizationSummary?.changedSectionsLimit ??
      GROUNDED_TAILORED_RESUME_LIMITS.changedSectionsMax,
    maximumSourceFactIdsObserved:
      initial.metadata.groundedNormalizationSummary
        ?.maximumSourceFactIdsObserved ??
      null,
    sourceFactIdLimit: GROUNDED_SOURCE_FACT_ID_LIMIT,
    sectionCount:
      initial.metadata.groundedNormalizationSummary?.sectionCount ?? null,
    sectionLinesLimit:
      initial.metadata.groundedNormalizationSummary?.sectionLinesLimit ??
      GROUNDED_TAILORED_RESUME_LIMITS.sectionLinesMax,
    sectionLineCounts:
      initial.metadata.groundedNormalizationSummary?.sectionLineCounts ?? [],
    maximumSectionLinesObserved:
      initial.metadata.groundedNormalizationSummary
        ?.maximumSectionLinesObserved ?? null,
    sectionLineCardinalityViolationCount:
      initial.metadata.groundedNormalizationSummary
        ?.sectionLineCardinalityViolationCount ?? 0,
    sectionLineCardinalityViolationPaths:
      initial.metadata.groundedNormalizationSummary
        ?.sectionLineCardinalityViolationPaths ?? [],
    skillsSectionLineCount:
      initial.metadata.groundedNormalizationSummary
        ?.skillsSectionLineCount ?? null,
    ...repairSummary,
    ...repairDiagnostics,
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

export class LegacyFullGroundedTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
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
      const reportBeforeRepair = report;
      let repaired: RepairCompletion | undefined;
      let repairTargets: FactualityRepairTarget[] = [];
      let repairPatchCount = 0;
      let repairApplied = false;
      let repairFailureCategory: FactualityRepairErrorCode | undefined;
      let repairSummary = emptyRepairSummary(report);
      let repairDiagnostics =
        createEmptyFactualityRepairDiagnostics(0);

      if (
        report.status !== "pass" &&
        input.requestPolicy?.allowFactualityRepair !== false
      ) {
        try {
          repairTargets = buildFactualityRepairTargets(
            grounded,
            report.violations,
          );
          repaired = await this.client.structuredCompletion({
            schemaName: "grounded_text_factuality_repair_patch",
            schema: factualityRepairPatchSchema,
            outputContract: buildFactualityRepairOutputContract(repairTargets),
            allowTransportRetry: input.requestPolicy?.allowTransportRetry,
            allowJsonRepair: false,
            allowFinalizationRetry: false,
            messages: buildFactualityRepairMessages(
              candidateFacts,
              jobRequirements,
              repairTargets,
            ),
          });
          repairDiagnostics = diagnoseFactualityRepairPatch(
            repaired.data,
            repairTargets,
            candidateFacts,
          );
          repairDiagnostics.repairHttpStatus =
            repaired.metadata.httpStatus ?? null;
          if (repairDiagnostics.repairDiagnosticIssueCount > 0) {
            throw new FactualityRepairError(
              repairDiagnosticErrorCode(repairDiagnostics),
            );
          }
          const patch = validateFactualityRepairPatch(
            repaired.data,
            repairTargets,
            candidateFacts,
          );
          repairPatchCount =
            repairDiagnostics.repairAcceptedPatchCount;
          try {
            grounded = applyFactualityRepairPatch(
              grounded,
              repairTargets,
              patch,
            );
            markRepairApplicationPassed(repairDiagnostics);
          } catch (error) {
            if (
              error instanceof FactualityRepairError &&
              error.code === "FACTUALITY_REPAIR_SCOPE_VIOLATION"
            ) {
              markRepairScopeFailure(repairDiagnostics);
            } else if (error instanceof ZodError) {
              markPostRepairSchemaFailure(repairDiagnostics);
            }
            throw error;
          }
          repairApplied = true;
          report = evaluateTailoredResumeFactuality(
            grounded,
            candidateFacts,
            jobRequirements,
          );
          markPostRepairFactuality(
            repairDiagnostics,
            report.status === "pass",
          );
          repairFailureCategory = classifyFactualityRepairOutcome(
            reportBeforeRepair,
            report,
          );
        } catch (error) {
          if (error instanceof FactualityRepairError) {
            repairFailureCategory = error.code as FactualityRepairErrorCode;
          } else if (error instanceof ZodError) {
            repairFailureCategory =
              "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID";
          } else if (
            error instanceof LLMClientError &&
            (
              error.code === "LLM_SCHEMA_VALIDATION_FAILED" ||
              error.code === "LLM_STRUCTURED_OUTPUT_INVALID"
            )
          ) {
            repaired = repairCompletionFromError(error, initial);
            repairDiagnostics =
              error.code === "LLM_SCHEMA_VALIDATION_FAILED"
                ? markRepairEnvelopeFailure(
                    repairTargets.length,
                    error.httpStatus ?? null,
                  )
                : markRepairJsonFailure(
                    repairTargets.length,
                    error.httpStatus ?? null,
                  );
            repairFailureCategory =
              error.code === "LLM_SCHEMA_VALIDATION_FAILED"
                ? "FACTUALITY_REPAIR_PATCH_SCHEMA_INVALID"
                : "FACTUALITY_REPAIR_RESPONSE_INVALID";
          } else {
            throw error;
          }
        }
        repairSummary = summarizeFactualityRepair(
          reportBeforeRepair,
          report,
          repairTargets,
          repairPatchCount,
          repairApplied,
          repairFailureCategory,
        );
      }

      const finalDiagnostics = diagnostics(
        report,
        initial,
        repaired,
        repairSummary,
        repairDiagnostics,
      );
      await this.client.recordSafeObservation({
        operation: "tailored_resume_result",
        provider: "llm_provider",
        model: initial.metadata.model,
        status: report.status === "pass" ? "success" : "failed",
        durationMs: Date.now() - startedAt,
        promptTokens: finalDiagnostics.inputTokens,
        completionTokens: finalDiagnostics.outputTokens,
        totalTokens: finalDiagnostics.totalTokens,
        errorCode:
          report.status === "pass" && !repairFailureCategory
            ? undefined
            : repairFailureCategory ??
              "TAILORED_RESUME_FACTUALITY_VIOLATION",
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
          rewriteExplanationReceivedType:
            finalDiagnostics.rewriteExplanationReceivedType,
          rewriteExplanationCount:
            finalDiagnostics.rewriteExplanationCount,
          rewriteExplanationLimit:
            finalDiagnostics.rewriteExplanationLimit,
          changedSectionsCount: finalDiagnostics.changedSectionsCount,
          maximumChangedSections: finalDiagnostics.maximumChangedSections,
          maximumSourceFactIdsObserved:
            finalDiagnostics.maximumSourceFactIdsObserved,
          sourceFactIdLimit: finalDiagnostics.sourceFactIdLimit,
          sectionCount: finalDiagnostics.sectionCount,
          sectionLinesLimit: finalDiagnostics.sectionLinesLimit,
          sectionLineCounts: finalDiagnostics.sectionLineCounts,
          maximumSectionLinesObserved:
            finalDiagnostics.maximumSectionLinesObserved,
          sectionLineCardinalityViolationCount:
            finalDiagnostics.sectionLineCardinalityViolationCount,
          sectionLineCardinalityViolationPaths:
            finalDiagnostics.sectionLineCardinalityViolationPaths,
          skillsSectionLineCount:
            finalDiagnostics.skillsSectionLineCount,
          factualityViolationCountBeforeRepair:
            finalDiagnostics.factualityViolationCountBeforeRepair,
          factualityRepairTargetCount:
            finalDiagnostics.factualityRepairTargetCount,
          factualityRepairPatchCount:
            finalDiagnostics.factualityRepairPatchCount,
          factualityRepairApplied:
            finalDiagnostics.factualityRepairApplied,
          factualityViolationCountAfterRepair:
            finalDiagnostics.factualityViolationCountAfterRepair,
          factualityViolationsResolved:
            finalDiagnostics.factualityViolationsResolved,
          factualityViolationsIntroduced:
            finalDiagnostics.factualityViolationsIntroduced,
          factualityRepairRemainingCategories:
            finalDiagnostics.factualityRepairRemainingCategories,
          factualityRepairScopeViolation:
            finalDiagnostics.factualityRepairScopeViolation,
          factualityRepairTargetPaths:
            finalDiagnostics.factualityRepairTargetPaths,
          factualityRepairTargetCategories:
            finalDiagnostics.factualityRepairTargetCategories,
          factualityRepairFailureCategory:
            finalDiagnostics.factualityRepairFailureCategory,
          repairHttpStatus: finalDiagnostics.repairHttpStatus,
          repairJsonStatus: finalDiagnostics.repairJsonStatus,
          repairEnvelopeStatus: finalDiagnostics.repairEnvelopeStatus,
          repairTargetCoverageStatus:
            finalDiagnostics.repairTargetCoverageStatus,
          repairPatchStructureStatus:
            finalDiagnostics.repairPatchStructureStatus,
          repairPatchSemanticStatus:
            finalDiagnostics.repairPatchSemanticStatus,
          repairScopeStatus: finalDiagnostics.repairScopeStatus,
          repairApplyStatus: finalDiagnostics.repairApplyStatus,
          postRepairSchemaStatus:
            finalDiagnostics.postRepairSchemaStatus,
          postRepairFactualityStatus:
            finalDiagnostics.postRepairFactualityStatus,
          repairExpectedTargetCount:
            finalDiagnostics.repairExpectedTargetCount,
          repairReceivedCount: finalDiagnostics.repairReceivedCount,
          repairAcceptedPatchCount:
            finalDiagnostics.repairAcceptedPatchCount,
          repairDiagnosticIssueCount:
            finalDiagnostics.repairDiagnosticIssueCount,
          repairReportedDiagnosticIssueCount:
            finalDiagnostics.repairReportedDiagnosticIssueCount,
          repairDiagnosticsTruncated:
            finalDiagnostics.repairDiagnosticsTruncated,
          repairDiagnosticCategories:
            finalDiagnostics.repairDiagnosticCategories,
          repairMissingTargetIds:
            finalDiagnostics.repairMissingTargetIds,
          repairUnknownTargetCount:
            finalDiagnostics.repairUnknownTargetCount,
          repairDuplicateTargetIds:
            finalDiagnostics.repairDuplicateTargetIds,
          repairTargetOrderMatches:
            finalDiagnostics.repairTargetOrderMatches,
          repairInvalidActionCount:
            finalDiagnostics.repairInvalidActionCount,
          repairInvalidReplacementCount:
            finalDiagnostics.repairInvalidReplacementCount,
          repairInvalidKindCount:
            finalDiagnostics.repairInvalidKindCount,
          repairKindLocationViolationCount:
            finalDiagnostics.repairKindLocationViolationCount,
          repairMaximumSourceFactIdsObserved:
            finalDiagnostics.repairMaximumSourceFactIdsObserved,
          repairSourceFactIdsLimit:
            finalDiagnostics.repairSourceFactIdsLimit,
          repairDuplicateSourceFactIdCount:
            finalDiagnostics.repairDuplicateSourceFactIdCount,
          repairUnknownSourceFactIdCount:
            finalDiagnostics.repairUnknownSourceFactIdCount,
          repairJdRequirementSourceIdCount:
            finalDiagnostics.repairJdRequirementSourceIdCount,
          repairSourceFactIdsOrderMismatchCount:
            finalDiagnostics.repairSourceFactIdsOrderMismatchCount,
          repairDiagnostics: finalDiagnostics.repairDiagnostics,
          httpStatus: finalDiagnostics.httpStatus,
          jsonStatus: "passed",
          normalizationStatus: "passed",
          schemaStatus: "passed",
          groundedSchemaStatus: "passed",
        },
      });
      if (report.status !== "pass" || repairFailureCategory) {
        const failure = new TailoredResumeFactualityError(
          report,
          repairFailureCategory ??
            "TAILORED_RESUME_FACTUALITY_VIOLATION",
        );
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

function withCompilerDiagnostics(
  base: TailoredResumeDiagnostics,
  compiler: GroundedCompilerDiagnostics,
): TailoredResumeDiagnostics {
  return {
    ...base,
    planJsonStatus: "passed",
    planSchemaStatus: "passed",
    planValidationStatus: "passed",
    compilerStatus: "passed",
    selectedFactCount: compiler.selectedFactCount,
    renderedFactCount: compiler.renderedFactCount,
    omittedFactCount: compiler.omittedFactCount,
    unrenderableFactCount: compiler.unrenderableFactCount,
    sectionFactSelectionCounts: compiler.sectionFactSelectionCounts,
    compilerSectionLineCounts: compiler.sectionLineCounts,
    compilerMaximumLineLength: compiler.maximumLineLength,
    compilerMaximumSourceFactIds: compiler.maximumSourceFactIds,
    applicationMaterialLineCounts:
      compiler.applicationMaterialLineCounts,
  };
}

/**
 * Production tailored-resume path. The model selects IDs and enums only;
 * every public string and GroundedText field is compiled locally.
 */
export class LLMTailoredResumeWriterProvider implements TailoredResumeWriterProvider {
  constructor(
    private readonly client = new LLMClient(),
    private readonly _fallback = new MockTailoredResumeWriterProvider(),
    private readonly _fallbackEnabled = false,
  ) {}

  async write(
    input: TailoredResumeWriterInput,
  ): Promise<TailoredResumeWriterOutput> {
    const candidateFacts = buildCandidateFactRegistry(
      input.profile,
      input.baseResumeMarkdown,
    );
    const renderDescriptors =
      buildCandidateFactRenderDescriptors(candidateFacts);
    const renderableIds = new Set(
      renderDescriptors
        .filter((descriptor) => descriptor.renderable)
        .map((descriptor) => descriptor.factId),
    );
    const selectableFacts = candidateFacts.filter((fact) =>
      renderableIds.has(fact.id),
    );
    const jobRequirements = buildJobRequirementFacts(
      input.jdAnalysis,
      candidateFacts,
    );
    const startedAt = Date.now();

    const planCompletion = await this.client.structuredCompletion({
      schemaName: "tailored_resume_selection_plan",
      schema: tailoredResumePlanSchema,
      outputContract: tailoredResumePlanOutputContract,
      messages: buildTailoredResumePlanMessages(
        selectableFacts,
        jobRequirements,
      ),
      allowTransportRetry: input.requestPolicy?.allowTransportRetry,
      allowJsonRepair: input.requestPolicy?.allowJsonRepair,
      allowFinalizationRetry: false,
    });

    let validated: ReturnType<typeof validateTailoredResumePlan>;
    try {
      validated = validateTailoredResumePlan(
        planCompletion.data,
        selectableFacts,
        renderDescriptors,
      );
    } catch (error) {
      if (error instanceof TailoredResumePlanError) {
        await this.client.recordSafeObservation({
          operation: "tailored_resume_result",
          provider: "llm_provider",
          model: planCompletion.metadata.model,
          status: "failed",
          durationMs: Date.now() - startedAt,
          promptTokens: planCompletion.usage?.prompt_tokens,
          completionTokens: planCompletion.usage?.completion_tokens,
          totalTokens: planCompletion.usage?.total_tokens,
          errorCode: error.code,
          fallbackUsed: false,
          metadata: {
            requestId: planCompletion.metadata.requestId,
            planJsonStatus: "passed",
            planSchemaStatus: "passed",
            planValidationStatus: "failed",
            compilerStatus: "not_reached",
            selectedFactCount:
              error.diagnostics?.selectedFactCount ?? 0,
            selectedReferenceCount:
              error.diagnostics?.selectedReferenceCount ?? 0,
            unrenderableSelectedFactCount:
              error.diagnostics?.unrenderableSelectedFactCount ?? 0,
          },
        });
      }
      throw error;
    }

    let compiled: ReturnType<typeof compileGroundedTailoredResume>;
    try {
      compiled = compileGroundedTailoredResume({
        plan: validated.plan,
        factRegistry: candidateFacts,
        renderDescriptors,
        jdAnalysis: input.jdAnalysis,
      });
    } catch (error) {
      if (error instanceof DeterministicGroundedCompilerError) {
        await this.client.recordSafeObservation({
          operation: "tailored_resume_result",
          provider: "llm_provider",
          model: planCompletion.metadata.model,
          status: "failed",
          durationMs: Date.now() - startedAt,
          promptTokens: planCompletion.usage?.prompt_tokens,
          completionTokens: planCompletion.usage?.completion_tokens,
          totalTokens: planCompletion.usage?.total_tokens,
          errorCode: error.code,
          fallbackUsed: false,
          metadata: {
            requestId: planCompletion.metadata.requestId,
            planJsonStatus: "passed",
            planSchemaStatus: "passed",
            planValidationStatus: "passed",
            compilerStatus: "failed",
            selectedFactCount:
              validated.diagnostics.selectedFactCount,
            selectedReferenceCount:
              validated.diagnostics.selectedReferenceCount,
          },
        });
      }
      throw error;
    }
    const report = evaluateTailoredResumeFactuality(
      compiled.grounded,
      candidateFacts,
      jobRequirements,
    );
    const groundedCompletion: GroundedCompletion = {
      data: compiled.grounded,
      usage: planCompletion.usage,
      metadata: {
        ...planCompletion.metadata,
        groundedNormalizationSummary: compiled.normalizationSummary,
        jsonStatus: "passed",
        normalizationStatus: "passed",
        schemaStatus: "passed",
        factualityStatus:
          report.status === "pass" ? "passed" : "failed",
        schemaValidationStatus: "passed",
      },
    };
    const finalDiagnostics = withCompilerDiagnostics(
      diagnostics(
        report,
        groundedCompletion,
        undefined,
        emptyRepairSummary(report),
        createEmptyFactualityRepairDiagnostics(0),
      ),
      compiled.diagnostics,
    );

    await this.client.recordSafeObservation({
      operation: "tailored_resume_result",
      provider: "llm_provider",
      model: planCompletion.metadata.model,
      status: report.status === "pass" ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      promptTokens: finalDiagnostics.inputTokens,
      completionTokens: finalDiagnostics.outputTokens,
      totalTokens: finalDiagnostics.totalTokens,
      errorCode:
        report.status === "pass"
          ? undefined
          : "DETERMINISTIC_COMPILER_FACTUALITY_BUG",
      fallbackUsed: false,
      metadata: {
        requestId: planCompletion.metadata.requestId,
        providerRequested: "llm_provider",
        providerUsed: "llm_provider",
        planJsonStatus: finalDiagnostics.planJsonStatus,
        planSchemaStatus: finalDiagnostics.planSchemaStatus,
        planValidationStatus: finalDiagnostics.planValidationStatus,
        compilerStatus: finalDiagnostics.compilerStatus,
        jsonStatus: "passed",
        normalizationStatus: "passed",
        schemaStatus: "passed",
        groundedSchemaStatus: "passed",
        factualityStatus: report.status,
        factualityViolationCount: report.violations.length,
        factualityViolationCategories:
          finalDiagnostics.factualityViolationCategories,
        factualityRepairCount: 0,
        externalRequestCount: finalDiagnostics.externalRequestCount,
        transportRetryCount: finalDiagnostics.transportRetryCount,
        jsonRepairCount: finalDiagnostics.jsonRepairCount,
        finalizationRetryCount: 0,
        reasoningFieldPresent:
          finalDiagnostics.reasoningFieldPresent,
        selectedFactCount: finalDiagnostics.selectedFactCount,
        renderedFactCount: finalDiagnostics.renderedFactCount,
        omittedFactCount: finalDiagnostics.omittedFactCount,
        unrenderableFactCount:
          finalDiagnostics.unrenderableFactCount,
        sectionFactSelectionCounts:
          finalDiagnostics.sectionFactSelectionCounts,
        sectionLineCounts:
          finalDiagnostics.compilerSectionLineCounts,
        maximumLineLength:
          finalDiagnostics.compilerMaximumLineLength,
        maximumSourceFactIds:
          finalDiagnostics.compilerMaximumSourceFactIds,
        applicationMaterialLineCounts:
          finalDiagnostics.applicationMaterialLineCounts,
      },
    });

    if (report.status !== "pass") {
      const failure = new TailoredResumeFactualityError(
        report,
        "DETERMINISTIC_COMPILER_FACTUALITY_BUG",
      );
      failure.diagnostics = finalDiagnostics;
      throw failure;
    }
    return {
      result: stripGroundingMetadata(compiled.grounded),
      diagnostics: finalDiagnostics,
    };
  }
}
