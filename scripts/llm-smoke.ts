import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { getAIConfig, publicAIConfig, validateAIConfig } from "../lib/ai-config";
import { jdAnalysisResultSchema } from "../schemas/jd";
import { careerStrategyGenerationResultSchema } from "../schemas/strategy";
import {
  LLMClient,
  LLMClientError,
  type LLMCompletionMetadata,
  type LLMResponseSafetySummary,
} from "../services/ai/llm-client";
import type { SafeSchemaDiagnosticSummary } from "../services/ai/schema-diagnostics";
import type { GroundedNormalizationSummary } from "../services/ai/tailored-resume-grounded-normalizer";
import { TailoredResumeFactualityError } from "../services/ai/tailored-resume-factuality";
import { createDatabaseLLMCallObserver } from "../services/ai/llm-observability";
import {
  careerStrategyOutputContract,
  jdAnalysisOutputContract,
} from "../services/ai/output-contracts";
import {
  LLMTailoredResumeWriterProvider,
  MockTailoredResumeWriterProvider,
  type TailoredResumeDiagnostics,
} from "../services/ai/tailored-resume-writer";
import {
  fictionalSmokeBaseResume,
  fictionalSmokeJD,
  fictionalSmokeJob,
  fictionalSmokeProfile,
} from "./llm-smoke-fixtures";
import {
  parseSmokeArguments,
  smokeRequestBudget,
  smokeRequestPolicy,
} from "./llm-smoke-selection";
import { createSmokeRequestLimiter } from "./llm-smoke-request-limit";

async function main() {
  loadEnvConfig(process.cwd());

  let selected;
  let explicitMaxExternalRequests: number | undefined;
  try {
    const parsed = parseSmokeArguments(process.argv.slice(2));
    selected = parsed.selected;
    explicitMaxExternalRequests = parsed.maxExternalRequests;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid smoke selection.");
    process.exitCode = 2;
    return;
  }
  const maxExternalRequests = smokeRequestBudget(selected, explicitMaxExternalRequests);
  let externalRequests = 0;
  const startedAt = Date.now();

  const config = getAIConfig();
  const safeConfig = publicAIConfig(config);
  const missing = [
    config.provider !== "llm_provider" ? "AI_PROVIDER=llm_provider" : "",
    !config.apiKey ? "LLM_API_KEY" : "",
    !config.model ? "LLM_MODEL" : "",
    !config.baseUrl ? "LLM_BASE_URL" : "",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`LLM smoke not executed. Missing prerequisites: ${missing.join(", ")}.`);
    process.exitCode = 2;
    return;
  }
  try {
    validateAIConfig(config);
  } catch (error) {
    console.error(`LLM smoke not executed. ${error instanceof Error ? error.message : "Invalid configuration."}`);
    process.exitCode = 2;
    return;
  }

  const limitedFetch = createSmokeRequestLimiter(
    fetch,
    maxExternalRequests,
    () => { externalRequests += 1; },
  );
  const client = new LLMClient(config, limitedFetch, createDatabaseLLMCallObserver());

  type SmokeSummary = {
    name: string;
    success: boolean;
    metadata?: LLMCompletionMetadata;
    diagnostics?: TailoredResumeDiagnostics;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    errorCategory?: string;
    factualityViolationCategories?: string[];
    responseSafetySummary?: LLMResponseSafetySummary;
    finalizationRetryCount?: number;
    externalRequestCount?: number;
    latencyMs?: number;
    schemaDiagnosticSummary?: SafeSchemaDiagnosticSummary;
    groundedNormalizationSummary?: GroundedNormalizationSummary;
    additionalRepairBlockedByRequestLimit?: boolean;
    httpStatus?: number;
  };
  const summaries: SmokeSummary[] = [];

  async function run<T>(
    name: string,
    schemaName: string,
    schema: z.ZodType<T>,
    messages: Array<{ role: "system" | "user"; content: string }>,
    outputContract?: string,
  ) {
    try {
      const result = await client.structuredCompletion({
        schemaName,
        schema,
        maxOutputTokens: Math.min(config.maxOutputTokens, 1600),
        outputContract,
        messages,
        allowTransportRetry: explicitMaxExternalRequests === undefined,
        allowJsonRepair: explicitMaxExternalRequests === undefined,
        allowFinalizationRetry: false,
      });
      summaries.push({
        name,
        success: true,
        metadata: result.metadata,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        totalTokens: result.usage?.total_tokens,
        responseSafetySummary: result.metadata.responseSafetySummary,
        httpStatus: result.metadata.httpStatus,
      });
      return result.data;
    } catch (error) {
      summaries.push({
        name,
        success: false,
        errorCategory: error instanceof LLMClientError ? error.code : "provider_error",
        responseSafetySummary:
          error instanceof LLMClientError ? error.responseSummary : undefined,
        inputTokens:
          error instanceof LLMClientError ? error.usage?.prompt_tokens : undefined,
        outputTokens:
          error instanceof LLMClientError ? error.usage?.completion_tokens : undefined,
        totalTokens:
          error instanceof LLMClientError ? error.usage?.total_tokens : undefined,
        finalizationRetryCount:
          error instanceof LLMClientError ? error.finalizationRetryCount : undefined,
        externalRequestCount:
          error instanceof LLMClientError ? error.externalRequestCount : undefined,
        latencyMs: error instanceof LLMClientError ? error.latencyMs : undefined,
        schemaDiagnosticSummary:
          error instanceof LLMClientError ? error.schemaDiagnosticSummary : undefined,
        groundedNormalizationSummary:
          error instanceof LLMClientError
            ? error.groundedNormalizationSummary
            : undefined,
        additionalRepairBlockedByRequestLimit:
          explicitMaxExternalRequests !== undefined &&
          error instanceof LLMClientError &&
          error.code === "LLM_SCHEMA_VALIDATION_FAILED",
        httpStatus: error instanceof LLMClientError ? error.httpStatus : undefined,
      });
      throw error;
    }
  }

  let jd = fictionalSmokeJD;
  try {
    if (selected.has("connection")) {
      await run(
        "Provider connection",
        "smoke_connection",
        z.object({ ok: z.literal(true) }),
        [
          { role: "system", content: "Return a minimal JSON health check." },
          { role: "user", content: 'Return {"ok":true}.' },
        ],
        "Object with exactly ok:true.",
      );
    }
    if (selected.has("jd-analysis")) {
      jd = jdAnalysisResultSchema.parse(await run(
        "JD analysis",
        "jd_analysis_result",
        jdAnalysisResultSchema,
        [
          { role: "system", content: "Analyze only the supplied fictional JD. Do not infer candidate capabilities." },
          { role: "user", content: JSON.stringify(fictionalSmokeJob) },
        ],
        jdAnalysisOutputContract,
      ));
    }
    if (selected.has("tailored-resume")) {
      try {
        const output = await new LLMTailoredResumeWriterProvider(
          client,
          new MockTailoredResumeWriterProvider(),
          false,
        ).write({
          profile: fictionalSmokeProfile,
          baseResumeMarkdown: fictionalSmokeBaseResume,
          jdAnalysis: jd,
          requestPolicy: smokeRequestPolicy(explicitMaxExternalRequests),
        });
        summaries.push({
          name: "Tailored resume",
          success: output.diagnostics.factualityStatus === "pass",
          diagnostics: output.diagnostics,
          inputTokens: output.diagnostics.inputTokens,
          outputTokens: output.diagnostics.outputTokens,
          totalTokens: output.diagnostics.totalTokens,
          factualityViolationCategories: output.diagnostics.factualityViolationCategories,
          responseSafetySummary: output.diagnostics.responseSafetySummary,
        });
      } catch (error) {
        const factualityDiagnostics =
          error instanceof TailoredResumeFactualityError
            ? error.diagnostics as TailoredResumeDiagnostics | undefined
            : undefined;
        const report = error && typeof error === "object" && "report" in error
          ? (error as { report?: { violations?: Array<{ category: string }> } }).report
          : undefined;
        summaries.push({
          name: "Tailored resume",
          success: false,
          errorCategory: error instanceof LLMClientError
            ? error.code
            : error instanceof TailoredResumeFactualityError
              ? factualityDiagnostics?.factualityRepairCount
                ? "FACTUALITY_REPAIR_FAILED"
                : "TAILORED_RESUME_FACTUALITY_VIOLATION"
            : error instanceof Error ? error.name : "provider_error",
          diagnostics: factualityDiagnostics,
          factualityViolationCategories: report?.violations
            ? [...new Set(report.violations.map((item) => item.category))]
            : undefined,
          responseSafetySummary:
            error instanceof LLMClientError ? error.responseSummary : undefined,
          inputTokens:
            error instanceof LLMClientError ? error.usage?.prompt_tokens : undefined,
          outputTokens:
            error instanceof LLMClientError ? error.usage?.completion_tokens : undefined,
          totalTokens:
            error instanceof LLMClientError ? error.usage?.total_tokens : undefined,
          finalizationRetryCount:
            error instanceof LLMClientError ? error.finalizationRetryCount : 0,
          externalRequestCount:
            error instanceof LLMClientError ? error.externalRequestCount : externalRequests,
          latencyMs: error instanceof LLMClientError ? error.latencyMs : undefined,
          schemaDiagnosticSummary:
            error instanceof LLMClientError ? error.schemaDiagnosticSummary : undefined,
          groundedNormalizationSummary:
            error instanceof LLMClientError
              ? error.groundedNormalizationSummary
              : undefined,
          additionalRepairBlockedByRequestLimit:
            explicitMaxExternalRequests !== undefined &&
            error instanceof LLMClientError &&
            error.code === "LLM_SCHEMA_VALIDATION_FAILED",
          httpStatus: error instanceof LLMClientError ? error.httpStatus : undefined,
        });
        throw error;
      }
    }
    if (selected.has("career-strategy")) {
      await run(
        "Career strategy",
        "career_strategy_generation_result",
        careerStrategyGenerationResultSchema,
        [
          {
            role: "system",
            content: "Create a conservative career strategy from fictional facts. Separate current capabilities, gaps, and recommendations.",
          },
          {
            role: "user",
            content: JSON.stringify({
              candidate: {
                background: "Fictional information and computer science student",
                skills: ["TypeScript", "Python", "PostgreSQL", "Next.js", "Git"],
                projects: ["Fictional course task-management project"],
              },
              job: fictionalSmokeJob,
            }),
          },
        ],
        careerStrategyOutputContract,
      );
    }
  } catch {
    // Stop after the selected case fails; safe summaries below retain no model content.
  }

  for (const summary of summaries) {
    const responseSummary =
      summary.responseSafetySummary ??
      summary.diagnostics?.responseSafetySummary ??
      summary.metadata?.responseSafetySummary;
    console.log(JSON.stringify({
      function: summary.name,
      status: summary.success ? "success" : "failed",
      providerRequested: "llm_provider",
      providerUsed: "llm_provider",
      model: config.model,
      thinkingModeRequested: config.thinkingMode,
      requestId: summary.metadata?.requestId,
      httpStatus:
        summary.diagnostics?.httpStatus ??
        summary.metadata?.httpStatus ??
        summary.httpStatus,
      latencyMs:
        summary.diagnostics?.latencyMs ??
        summary.metadata?.latencyMs ??
        summary.latencyMs,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      totalTokens: summary.totalTokens,
      estimatedCostMicros: summary.metadata?.estimatedCostMicros,
      costCurrency: summary.metadata?.priceCurrency,
      fallbackUsed: false,
      jsonParse:
        summary.success ||
        summary.diagnostics !== undefined ||
        summary.errorCategory === "LLM_SCHEMA_VALIDATION_FAILED" ||
        summary.errorCategory === "TAILORED_RESUME_FACTUALITY_VIOLATION"
          ? "passed"
          : summary.errorCategory === "LLM_STRUCTURED_OUTPUT_INVALID"
            ? "failed"
            : undefined,
      schemaValidation:
        summary.success || summary.diagnostics !== undefined
          ? "passed"
          : "failed",
      factualityStatus: summary.diagnostics?.factualityStatus,
      factualityRepairCount: summary.diagnostics?.factualityRepairCount,
      groundedClaimCount: summary.diagnostics?.groundedClaimCount,
      ungroundedClaimCount: summary.diagnostics?.ungroundedClaimCount,
      unknownFactIds: summary.diagnostics?.unknownFactIds,
      missingSourceIds: summary.diagnostics?.missingSourceIds,
      groundedNormalizationApplied:
        summary.diagnostics?.groundedNormalizationApplied ??
        summary.metadata?.groundedNormalizationSummary?.groundedNormalizationApplied ??
        summary.groundedNormalizationSummary?.groundedNormalizationApplied,
      defaultedApplicationMaterialArrayCount:
        summary.diagnostics?.defaultedApplicationMaterialArrayCount ??
        summary.metadata?.groundedNormalizationSummary?.defaultedApplicationMaterialArrays.length ??
        summary.groundedNormalizationSummary?.defaultedApplicationMaterialArrays.length,
      defaultedApplicationMaterialPaths:
        summary.diagnostics?.defaultedApplicationMaterialPaths ??
        summary.metadata?.groundedNormalizationSummary?.defaultedApplicationMaterialArrays ??
        summary.groundedNormalizationSummary?.defaultedApplicationMaterialArrays,
      canonicalizedSectionTypeCount:
        summary.diagnostics?.canonicalizedSectionTypeCount ??
        summary.metadata?.groundedNormalizationSummary?.canonicalizedSectionTypes ??
        summary.groundedNormalizationSummary?.canonicalizedSectionTypes,
      deduplicatedSourceFactIdCount:
        summary.diagnostics?.deduplicatedSourceFactIdCount ??
        summary.metadata?.groundedNormalizationSummary?.deduplicatedFactIdCount ??
        summary.groundedNormalizationSummary?.deduplicatedFactIdCount,
      sourceFactIdLimit:
        summary.diagnostics?.sourceFactIdLimit ??
        summary.metadata?.groundedNormalizationSummary?.sourceFactIdLimit ??
        summary.groundedNormalizationSummary?.sourceFactIdLimit,
      reasoningFieldPresent: summary.diagnostics?.reasoningFieldPresent ?? summary.metadata?.reasoningFieldPresent,
      finalizationRetryCount:
        summary.diagnostics?.finalizationRetryCount ??
        summary.metadata?.finalizationRetryCount ??
        summary.finalizationRetryCount,
      externalRequestCount:
        summary.diagnostics?.externalRequestCount ??
        summary.metadata?.externalRequestCount ??
        summary.externalRequestCount,
      responseIdPresent: responseSummary
        ? responseSummary.responseId !== null
        : undefined,
      choiceCount: responseSummary?.choiceCount,
      messagePresent: responseSummary?.messagePresent,
      contentState: responseSummary?.contentState,
      contentCharacterLength: responseSummary?.contentCharacterLength,
      contentByteLength: responseSummary?.contentByteLength,
      finishReason: responseSummary?.finishReason,
      outputLimitReached: responseSummary?.outputLimitReached,
      schemaDiagnostics: summary.schemaDiagnosticSummary,
      additionalRepairBlockedByRequestLimit:
        summary.additionalRepairBlockedByRequestLimit,
      violationCategories: summary.factualityViolationCategories,
      errorCategory: summary.errorCategory,
    }));
  }
  console.log(JSON.stringify({
    selectedCases: [...selected],
    provider: "llm_provider",
    model: config.model,
    baseUrl: safeConfig.baseUrl,
    externalRequestCount: externalRequests,
    totalLatencyMs: Date.now() - startedAt,
    requestBudget: maxExternalRequests,
  }));
  if (summaries.length !== selected.size || summaries.some((summary) => !summary.success)) {
    process.exitCode = 1;
  }
}

void main();
