import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { getAIConfig, publicAIConfig, validateAIConfig } from "../lib/ai-config";
import { jdAnalysisResultSchema } from "../schemas/jd";
import { careerStrategyGenerationResultSchema } from "../schemas/strategy";
import { LLMClient, LLMClientError, type LLMCompletionMetadata } from "../services/ai/llm-client";
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
import { parseSmokeSelection, smokeRequestBudget } from "./llm-smoke-selection";

async function main() {
  loadEnvConfig(process.cwd());

  let selected;
  try {
    selected = parseSmokeSelection(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid smoke selection.");
    process.exitCode = 2;
    return;
  }
  const maxExternalRequests = smokeRequestBudget(selected);
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

  const limitedFetch: typeof fetch = async (request, init) => {
    if (externalRequests >= maxExternalRequests) {
      throw new LLMClientError(
        "provider_error",
        `Smoke request budget of ${maxExternalRequests} external calls was exhausted.`,
      );
    }
    externalRequests += 1;
    return fetch(request, init);
  };
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
      });
      summaries.push({
        name,
        success: true,
        metadata: result.metadata,
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        totalTokens: result.usage?.total_tokens,
      });
      return result.data;
    } catch (error) {
      summaries.push({
        name,
        success: false,
        errorCategory: error instanceof LLMClientError ? error.code : "provider_error",
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
        });
        summaries.push({
          name: "Tailored resume",
          success: output.diagnostics.factualityStatus === "pass",
          diagnostics: output.diagnostics,
          inputTokens: output.diagnostics.inputTokens,
          outputTokens: output.diagnostics.outputTokens,
          totalTokens: output.diagnostics.totalTokens,
          factualityViolationCategories: output.diagnostics.factualityViolationCategories,
        });
      } catch (error) {
        const report = error && typeof error === "object" && "report" in error
          ? (error as { report?: { violations?: Array<{ category: string }> } }).report
          : undefined;
        summaries.push({
          name: "Tailored resume",
          success: false,
          errorCategory: error instanceof LLMClientError
            ? error.code
            : error instanceof Error ? error.name : "provider_error",
          factualityViolationCategories: report?.violations
            ? [...new Set(report.violations.map((item) => item.category))]
            : undefined,
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
    console.log(JSON.stringify({
      function: summary.name,
      status: summary.success ? "success" : "failed",
      providerRequested: "llm_provider",
      providerUsed: "llm_provider",
      model: config.model,
      requestId: summary.metadata?.requestId,
      latencyMs: summary.diagnostics?.latencyMs ?? summary.metadata?.latencyMs,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      totalTokens: summary.totalTokens,
      estimatedCostMicros: summary.metadata?.estimatedCostMicros,
      costCurrency: summary.metadata?.priceCurrency,
      fallbackUsed: false,
      schemaValidation: summary.success ? "passed" : "failed",
      factualityStatus: summary.diagnostics?.factualityStatus,
      factualityRepairCount: summary.diagnostics?.factualityRepairCount,
      groundedClaimCount: summary.diagnostics?.groundedClaimCount,
      ungroundedClaimCount: summary.diagnostics?.ungroundedClaimCount,
      unknownFactIds: summary.diagnostics?.unknownFactIds,
      missingSourceIds: summary.diagnostics?.missingSourceIds,
      reasoningFieldPresent: summary.diagnostics?.reasoningFieldPresent ?? summary.metadata?.reasoningFieldPresent,
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
