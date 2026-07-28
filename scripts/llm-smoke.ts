import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { getAIConfig, publicAIConfig, validateAIConfig } from "../lib/ai-config";
import { jdAnalysisResultSchema, tailoredResumeResultSchema } from "../schemas/jd";
import { careerStrategyGenerationResultSchema } from "../schemas/strategy";
import { LLMClient, LLMClientError, type LLMCompletionMetadata } from "../services/ai/llm-client";
import {
  careerStrategyOutputContract,
  jdAnalysisOutputContract,
  tailoredResumeOutputContract,
} from "../services/ai/output-contracts";

async function main() {
  loadEnvConfig(process.cwd());

  const MAX_EXTERNAL_REQUESTS = 6;
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
  } else {
    try {
      validateAIConfig(config);
    } catch (error) {
      console.error(`LLM smoke not executed. ${error instanceof Error ? error.message : "Invalid configuration."}`);
      process.exitCode = 2;
    }
  }

  if (process.exitCode) {
    // Preflight intentionally performs no external request.
  } else {
  const limitedFetch: typeof fetch = async (request, init) => {
    if (externalRequests >= MAX_EXTERNAL_REQUESTS) {
      throw new LLMClientError(
        "provider_error",
        `Smoke request budget of ${MAX_EXTERNAL_REQUESTS} external calls was exhausted.`,
      );
    }
    externalRequests += 1;
    return fetch(request, init);
  };
  const client = new LLMClient(config, limitedFetch);
  const demoFacts = {
    candidate: {
      background: "Fictional information and computer science student",
      skills: ["TypeScript", "Python", "PostgreSQL"],
      projects: ["A fictional course project that provides a small task-management web application"],
      restrictions: ["No real employer, achievement metric, credential, or personal information"],
    },
    job: {
      company: "示例科技有限公司（虚构）",
      role: "AI 应用开发实习生",
      requirements: ["TypeScript", "Python", "LLM API", "database fundamentals"],
    },
  };

  type SmokeSummary = {
    name: string;
    success: boolean;
    metadata?: LLMCompletionMetadata;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    error?: string;
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
      const safeError = error instanceof LLMClientError
        ? `${error.code}: ${error.message}`
        : error instanceof Error ? error.message : "unknown error";
      summaries.push({ name, success: false, error: safeError.slice(0, 300) });
      throw error;
    }
  }

  try {
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
    const jd = await run(
      "JD analysis",
      "jd_analysis_result",
      jdAnalysisResultSchema,
      [
        {
          role: "system",
          content: "Analyze only the supplied fictional JD. Do not infer candidate capabilities.",
        },
        { role: "user", content: JSON.stringify(demoFacts.job) },
      ],
      jdAnalysisOutputContract,
    );
    await run(
      "Tailored resume",
      "tailored_resume_result",
      tailoredResumeResultSchema,
      [
        {
          role: "system",
          content:
            "Create a Chinese tailored resume from fictional candidate facts. Never invent facts or metrics. Put unsupported JD requirements in warnings.",
        },
        {
          role: "user",
          content: JSON.stringify({
            candidateFacts: demoFacts.candidate,
            jdRequirements: jd,
            baseResume: "虚构候选人；技能：TypeScript、Python、PostgreSQL；课程项目：任务管理 Web 应用。",
          }),
        },
      ],
      tailoredResumeOutputContract,
    );
    await run(
      "Career strategy",
      "career_strategy_generation_result",
      careerStrategyGenerationResultSchema,
      [
        {
          role: "system",
          content:
            "Create a conservative career strategy from fictional facts. Separate current capabilities, gaps, and recommendations.",
        },
        { role: "user", content: JSON.stringify(demoFacts) },
      ],
      careerStrategyOutputContract,
    );
  } catch {
    // Per-step safe summaries below show the first failure. Stop to preserve request budget.
  }

  for (const summary of summaries) {
    console.log(JSON.stringify({
      function: summary.name,
      status: summary.success ? "success" : "failed",
      provider: "llm_provider",
      model: config.model,
      requestId: summary.metadata?.requestId,
      latencyMs: summary.metadata?.latencyMs,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      totalTokens: summary.totalTokens,
      estimatedCostMicros: summary.metadata?.estimatedCostMicros,
      costCurrency: summary.metadata?.priceCurrency,
      fallbackUsed: false,
      schemaValidation: summary.success ? "passed" : "failed",
      error: summary.error,
    }));
  }
  console.log(JSON.stringify({
    provider: "llm_provider",
    model: config.model,
    baseUrl: safeConfig.baseUrl,
    externalRequestCount: externalRequests,
    totalLatencyMs: Date.now() - startedAt,
    requestBudget: MAX_EXTERNAL_REQUESTS,
  }));
  if (summaries.length !== 4 || summaries.some((summary) => !summary.success)) process.exitCode = 1;
  }
}

void main();
