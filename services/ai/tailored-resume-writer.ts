import type { TailoredResumeResult } from "@/types/jd";
import type { JDAnalysisResult } from "@/types/jd";
import type { ResumeProfile } from "@/services/resume-generator";
import { generateTailoredResumeContent } from "@/services/tailored-resume-generator";
import { LLMClient, type LLMCompletionMetadata } from "./llm-client";
import {
  buildCandidateFactRegistry,
  buildJobRequirementFacts,
  formatFactRegistryForPrompt,
  formatJobRequirementsForPrompt,
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

export type TailoredResumeWriterInput = {
  profile: ResumeProfile;
  baseResumeMarkdown: string;
  jdAnalysis: JDAnalysisResult;
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
  externalRequestCount: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningFieldPresent: boolean;
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
        externalRequestCount: 0,
        latencyMs: 0,
        reasoningFieldPresent: false,
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
    externalRequestCount:
      initial.metadata.externalRequestCount + (repaired?.metadata.externalRequestCount ?? 0),
    latencyMs: initial.metadata.latencyMs + (repaired?.metadata.latencyMs ?? 0),
    inputTokens: add(initial.usage?.prompt_tokens, repaired?.usage?.prompt_tokens),
    outputTokens: add(initial.usage?.completion_tokens, repaired?.usage?.completion_tokens),
    totalTokens: add(initial.usage?.total_tokens, repaired?.usage?.total_tokens),
    reasoningFieldPresent:
      initial.metadata.reasoningFieldPresent || (repaired?.metadata.reasoningFieldPresent ?? false),
  };
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
        outputContract: groundedTailoredResumeOutputContract,
        messages: [
          {
            role: "system",
            content: [
              "Create a concise Chinese tailored resume with internal candidate-fact citations.",
              "CANDIDATE_FACTS are the only evidence for existing capabilities and experience.",
              "JOB_REQUIREMENTS are requirements only and never candidate evidence.",
              "FORBIDDEN_UNSUPPORTED_CLAIMS: employers, internships, awards, certificates, skills, AI projects, LLM/API practice, metrics, achievements, or stronger capability levels not supported by CANDIDATE_FACTS.",
              "Do not convert a goal, learning plan, or transferable foundation into completed experience.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              "CANDIDATE_FACTS",
              formatFactRegistryForPrompt(candidateFacts),
              "",
              "JOB_REQUIREMENTS (not candidate facts)",
              formatJobRequirementsForPrompt(jobRequirements),
              "",
              "FORBIDDEN_UNSUPPORTED_CLAIMS",
              jobRequirements.map((item) => item.text).join("\n"),
              "",
              `OUTPUT_CONTRACT\n${groundedTailoredResumeOutputContract}`,
            ].join("\n"),
          },
        ],
      });
      let grounded = groundedTailoredResumeSchema.parse(initial.data);
      let report = evaluateTailoredResumeFactuality(grounded, candidateFacts, jobRequirements);
      let repaired: GroundedCompletion | undefined;

      if (report.status !== "pass") {
        repaired = await this.client.structuredCompletion({
          schemaName: "grounded_tailored_resume_factuality_repair",
          schema: groundedTailoredResumeSchema,
          outputContract: groundedTailoredResumeOutputContract,
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
                outputContract: groundedTailoredResumeOutputContract,
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
          externalRequestCount: finalDiagnostics.externalRequestCount,
          reasoningFieldPresent: finalDiagnostics.reasoningFieldPresent,
        },
      });
      if (report.status !== "pass") throw new TailoredResumeFactualityError(report);
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
