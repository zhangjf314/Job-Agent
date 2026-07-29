import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  careerStrategyOutputContract,
  tailoredResumeOutputContract,
} from "../services/ai/output-contracts";
import {
  AIConfigurationError,
  getAIConfig,
  isLLMConfigured,
  publicAIConfig,
  validateAIConfig,
} from "@/lib/ai-config";
import {
  createJDAnalyzerProvider,
  getEffectiveAIProvider,
} from "@/services/ai/provider-factory";
import {
  chatCompletionsEndpoint,
  LLMClient,
  LLMClientError,
} from "@/services/ai/llm-client";
import { LLMJDAnalyzerProvider, MockJDAnalyzerProvider } from "@/services/ai/jd-analyzer";
import type { LLMCallObserver } from "@/services/ai/llm-observability";

const tinySchema = z.object({ ok: z.literal(true), message: z.string().optional().default("ok") });

function realConfig(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  return getAIConfig({
    AI_PROVIDER: "llm_provider",
    LLM_API_KEY: "test-secret",
    LLM_MODEL: "test-model",
    LLM_BASE_URL: "https://llm.example.test/v1",
    LLM_RETRY_COUNT: "0",
    ...overrides,
  });
}

function completion(content: string | null, init?: {
  status?: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  headers?: Record<string, string>;
  reasoningContent?: string;
  finishReason?: string | null;
  omitChoices?: boolean;
  omitMessage?: boolean;
  omitContent?: boolean;
  omitResponseId?: boolean;
}) {
  return new Response(
    JSON.stringify({
      ...(init?.omitResponseId ? {} : { id: "provider-id" }),
      model: "test-model",
      ...(init?.omitChoices
        ? {}
        : {
            choices: [{
              finish_reason: init?.finishReason,
              ...(init?.omitMessage
                ? {}
                : {
                    message: {
                      ...(init?.omitContent ? {} : { content }),
                      ...(init?.reasoningContent === undefined
                        ? {}
                        : { reasoning_content: init.reasoningContent }),
                    },
                  }),
            }],
          }),
      usage: init?.usage,
    }),
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

function client(
  fetcher: typeof fetch,
  overrides: Partial<NodeJS.ProcessEnv> = {},
  observer?: LLMCallObserver,
) {
  return new LLMClient(realConfig(overrides), fetcher, observer, {
    sleep: async () => {},
    random: () => 0,
    createRequestId: () => "logical-id",
  });
}

function input() {
  return {
    schemaName: "tiny",
    schema: tinySchema,
    messages: [{ role: "user" as const, content: "test" }],
  };
}

describe("AI provider configuration", () => {
  it("allows Mock mode without real-provider values", () => {
    const config = getAIConfig({ AI_PROVIDER: "mock" });
    expect(validateAIConfig(config).provider).toBe("mock");
    expect(getEffectiveAIProvider(config)).toBe("mock");
  });

  it("requires an API key in real mode", () => {
    expect(() => validateAIConfig(realConfig({ LLM_API_KEY: "" }))).toThrow(/LLM_API_KEY/);
  });

  it("requires a model in real mode", () => {
    expect(() => validateAIConfig(realConfig({ LLM_MODEL: "" }))).toThrow(/LLM_MODEL/);
  });

  it("requires a base URL in real mode", () => {
    expect(() => validateAIConfig(realConfig({ LLM_BASE_URL: "" }))).toThrow(/LLM_BASE_URL/);
  });

  it("rejects a malformed base URL", () => {
    expect(() => validateAIConfig(realConfig({ LLM_BASE_URL: "not-a-url" }))).toThrow(AIConfigurationError);
  });

  it("rejects a non-HTTP base URL", () => {
    expect(() => validateAIConfig(realConfig({ LLM_BASE_URL: "file:///tmp/model" }))).toThrow(/HTTP/);
  });

  it.each([
    ["LLM_TIMEOUT_MS", "abc"],
    ["LLM_TIMEOUT_MS", "99"],
    ["LLM_TEMPERATURE", "-1"],
    ["LLM_TEMPERATURE", "2.1"],
    ["LLM_RETRY_COUNT", "-1"],
    ["LLM_RETRY_COUNT", "6"],
    ["LLM_MAX_OUTPUT_TOKENS", "0"],
  ])("rejects invalid %s=%s", (name, value) => {
    expect(() => validateAIConfig(realConfig({ [name]: value }))).toThrow();
  });

  it("accepts temperature and retry count of zero", () => {
    const config = realConfig({ LLM_TEMPERATURE: "0", LLM_RETRY_COUNT: "0" });
    expect(validateAIConfig(config).temperature).toBe(0);
    expect(config.retryCount).toBe(0);
  });

  it("does not silently select Mock for invalid real configuration", () => {
    const config = realConfig({ LLM_API_KEY: "" });
    expect(isLLMConfigured(config)).toBe(false);
    expect(() => getEffectiveAIProvider(config)).toThrow(/LLM_API_KEY/);
    expect(() => createJDAnalyzerProvider(config)).toThrow(/LLM_API_KEY/);
  });

  it("selects the real provider when configuration is valid", () => {
    const config = realConfig();
    expect(isLLMConfigured(config)).toBe(true);
    expect(createJDAnalyzerProvider(config).constructor.name).toBe("LLMJDAnalyzerProvider");
  });

  it("redacts URL credentials and query values in public status", () => {
    const status = publicAIConfig(realConfig({
      LLM_BASE_URL: "https://user:pass@llm.example.test/v1?token=secret#fragment",
    }));
    expect(status.baseUrl).toBe("https://llm.example.test/v1");
    expect(JSON.stringify(status)).not.toContain("pass");
    expect(JSON.stringify(status)).not.toContain("test-secret");
  });
});

describe("OpenAI-compatible HTTP client", () => {
  it("handles a valid 200 response", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    [401, "authentication_failed"],
    [403, "forbidden"],
    [404, "not_found"],
    [400, "bad_request"],
  ])("does not retry HTTP %i", async (status, code) => {
    const fetcher = vi.fn(async () => new Response("safe error", { status })) as typeof fetch;
    await expect(client(fetcher, { LLM_RETRY_COUNT: "2" }).structuredCompletion(input()))
      .rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("suggests disabling JSON mode for a 400 response", async () => {
    const fetcher = vi.fn(async () => new Response("unsupported response_format", { status: 400 })) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).rejects.toThrow(/LLM_JSON_MODE=false/);
  });

  it.each([408, 429, 500, 503])("retries retryable HTTP %i", async (status) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status }))
      .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
    const result = await client(fetcher, { LLM_RETRY_COUNT: "1" }).structuredCompletion(input());
    expect(result.metadata.retryCount).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries a network error", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("DNS lookup failed"))
      .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
    await expect(client(fetcher, { LLM_RETRY_COUNT: "1" }).structuredCompletion(input())).resolves.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops at the configured retry limit", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 500 })) as typeof fetch;
    await expect(client(fetcher, { LLM_RETRY_COUNT: "2" }).structuredCompletion(input()))
      .rejects.toMatchObject({ code: "provider_error" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("aborts a timed-out request", async () => {
    const fetcher = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
    await expect(client(fetcher, { LLM_TIMEOUT_MS: "100" }).structuredCompletion(input()))
      .rejects.toMatchObject({ code: "timeout" });
    expect(vi.mocked(fetcher).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("sends response_format when JSON mode is enabled", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    await client(fetcher).structuredCompletion(input());
    const body = JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when JSON mode is disabled", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    await client(fetcher, { LLM_JSON_MODE: "false" }).structuredCompletion(input());
    const body = JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body));
    expect(body).not.toHaveProperty("response_format");
  });

  it.each([
    ["https://example.test", "https://example.test/v1/chat/completions"],
    ["https://example.test/", "https://example.test/v1/chat/completions"],
    ["https://example.test/v1", "https://example.test/v1/chat/completions"],
    ["https://example.test/v1/", "https://example.test/v1/chat/completions"],
    ["https://example.test/v1/chat/completions", "https://example.test/v1/chat/completions"],
  ])("joins base URL %s", (base, expected) => {
    expect(chatCompletionsEndpoint(base)).toBe(expected);
  });

  it("reads token usage without inventing values", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}', {
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    })) as typeof fetch;
    const result = await client(fetcher).structuredCompletion(input());
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 });
  });

  it("handles a provider response without usage", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    const result = await client(fetcher).structuredCompletion(input());
    expect(result.usage).toBeUndefined();
    expect(result.metadata.estimatedCostMicros).toBeUndefined();
  });
});

describe("structured output", () => {
  it("bounds complex business contracts for fixed provider output budgets", () => {
    expect(tailoredResumeOutputContract).toContain("contentMarkdown at most 900 Chinese characters");
    expect(tailoredResumeOutputContract).toContain("4 to 6 sections");
    expect(careerStrategyOutputContract).toContain("exactly 1 recommendation");
    expect(careerStrategyOutputContract).toContain("exactly 2 actionPlan items");
    expect(careerStrategyOutputContract).toContain("at most 2 short items");
  });

  it("uses only final content and records reasoning-field presence without storing reasoning text", async () => {
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = { async record(record) { records.push(record); } };
    const fetcher = vi.fn(async () => completion(
      '{"ok":true,"message":"PRIVATE FINAL CONTENT"}',
      {
      reasoningContent: "PRIVATE REASONING MUST NOT BE STORED",
      },
    )) as typeof fetch;
    const result = await client(fetcher, {}, observer).structuredCompletion(input());

    expect(result.data).toEqual({ ok: true, message: "PRIVATE FINAL CONTENT" });
    expect(result.metadata.reasoningFieldPresent).toBe(true);
    expect(result.metadata.responseSafetySummary).toMatchObject({
      responseId: "provider-id",
      choiceCount: 1,
      firstChoicePresent: true,
      messagePresent: true,
      contentState: "present",
      contentCharacterLength: expect.any(Number),
      contentByteLength: expect.any(Number),
      reasoningFieldPresent: true,
    });
    expect(records[0].metadata).toMatchObject({ reasoningFieldPresent: true });
    expect(JSON.stringify(records)).not.toContain("PRIVATE REASONING MUST NOT BE STORED");
    expect(JSON.stringify(records)).not.toContain("PRIVATE FINAL CONTENT");
  });

  it("reports reasoning-field absence without inventing it", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    const result = await client(fetcher).structuredCompletion(input());
    expect(result.metadata.reasoningFieldPresent).toBe(false);
  });

  it.each([
    ["missing", null, { omitContent: true }, "LLM_EMPTY_FINAL_CONTENT"],
    ["null", null, {}, "LLM_EMPTY_FINAL_CONTENT"],
    ["empty", "", {}, "LLM_EMPTY_FINAL_CONTENT"],
    ["whitespace", " \n\t", {}, "LLM_EMPTY_FINAL_CONTENT"],
  ] as const)(
    "classifies %s final content and preserves only safe response metadata",
    async (state, content, completionInit, code) => {
      const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
      const observer: LLMCallObserver = { async record(record) { records.push(record); } };
      const fetcher = vi.fn(async () => completion(content, {
        ...completionInit,
        finishReason: "stop",
        usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      })) as typeof fetch;
      await expect(client(fetcher, {}, observer).structuredCompletion(input()))
        .rejects.toMatchObject({
          code,
          responseSummary: {
            contentState: state,
            responseId: "provider-id",
            choiceCount: 1,
            firstChoicePresent: true,
            messagePresent: true,
            promptTokens: 12,
            completionTokens: 3,
            totalTokens: 15,
          },
        });
      expect(records[0]).toMatchObject({
        errorCode: code,
        promptTokens: 12,
        completionTokens: 3,
        totalTokens: 15,
        metadata: {
          contentState: state,
          contentCharacterLength: state === "missing" || state === "null" ? null : expect.any(Number),
          contentByteLength: state === "missing" || state === "null" ? null : expect.any(Number),
        },
      });
    },
  );

  it("distinguishes missing choices and missing messages without finalization retry", async () => {
    const choicesMissing = vi.fn(async () => completion(null, { omitChoices: true })) as typeof fetch;
    await expect(client(choicesMissing).structuredCompletion({
      ...input(),
      finalizationRetryMessages: input().messages,
    })).rejects.toMatchObject({ code: "LLM_CHOICES_MISSING" });
    expect(choicesMissing).toHaveBeenCalledOnce();

    const messageMissing = vi.fn(async () => completion(null, { omitMessage: true })) as typeof fetch;
    await expect(client(messageMissing).structuredCompletion({
      ...input(),
      finalizationRetryMessages: input().messages,
    })).rejects.toMatchObject({ code: "LLM_MESSAGE_MISSING" });
    expect(messageMissing).toHaveBeenCalledOnce();
  });

  it("distinguishes reasoning-only and output-limit empty responses", async () => {
    const reasoningOnly = vi.fn(async () => completion("", {
      reasoningContent: "PRIVATE REASONING",
      finishReason: "stop",
    })) as typeof fetch;
    await expect(client(reasoningOnly).structuredCompletion(input())).rejects.toMatchObject({
      code: "LLM_EMPTY_FINAL_CONTENT_AFTER_REASONING",
      responseSummary: { reasoningFieldPresent: true, outputLimitReached: null },
    });

    const outputLimited = vi.fn(async () => completion("", {
      reasoningContent: "PRIVATE REASONING",
      finishReason: "length",
    })) as typeof fetch;
    await expect(client(outputLimited).structuredCompletion(input())).rejects.toMatchObject({
      code: "LLM_OUTPUT_LIMIT_REACHED_WITHOUT_FINAL_CONTENT",
      responseSummary: { reasoningFieldPresent: true, outputLimitReached: true },
    });

    const tokenLimited = vi.fn(async () => completion("", {
      finishReason: "stop",
      usage: { prompt_tokens: 10, completion_tokens: 1600, total_tokens: 1610 },
    })) as typeof fetch;
    await expect(client(tokenLimited).structuredCompletion({
      ...input(),
      maxOutputTokens: 1600,
    })).rejects.toMatchObject({
      code: "LLM_OUTPUT_LIMIT_REACHED_WITHOUT_FINAL_CONTENT",
      responseSummary: { completionTokens: 1600, outputLimitReached: true },
    });
  });

  it("uses null when the provider omits usage and response ID", async () => {
    const fetcher = vi.fn(async () => completion("", {
      omitResponseId: true,
      finishReason: "stop",
    })) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).rejects.toMatchObject({
      responseSummary: {
        responseId: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        outputLimitReached: null,
      },
    });
  });

  it.each([
    ["missing", null, { omitContent: true }],
    ["null", null, {}],
    ["reasoning-only", "", { reasoningContent: "PRIVATE REASONING" }],
    ["output-limit", "", { finishReason: "length" }],
  ] as const)(
    "finalization-retries %s content once",
    async (_state, content, completionInit) => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce(completion(content, completionInit))
        .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
      await expect(client(fetcher).structuredCompletion({
        ...input(),
        finalizationRetryMessages: input().messages,
      })).resolves.toMatchObject({
        data: { ok: true },
        metadata: { finalizationRetryCount: 1, externalRequestCount: 2 },
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it("uses exactly one finalization retry and aggregates usage, latency metadata, and counters", async () => {
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = { async record(record) { records.push(record); } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(completion("", {
        reasoningContent: "PRIVATE REASONING",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }))
      .mockResolvedValueOnce(completion('{"ok":true}', {
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
        finishReason: "stop",
      })) as typeof fetch;
    const result = await client(fetcher, {}, observer).structuredCompletion({
      ...input(),
      finalizationRetryMessages: [{ role: "user", content: "SAFE FINALIZATION INPUT" }],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.usage).toEqual({ prompt_tokens: 17, completion_tokens: 8, total_tokens: 25 });
    expect(result.metadata).toMatchObject({
      finalizationRetryCount: 1,
      externalRequestCount: 2,
      retryCount: 0,
      reasoningFieldPresent: true,
      responseSafetySummary: { contentState: "present" },
    });
    const finalizationBody = String(vi.mocked(fetcher).mock.calls[1][1]?.body);
    expect(finalizationBody).toContain("SAFE FINALIZATION INPUT");
    expect(finalizationBody).not.toContain("PRIVATE REASONING");
    expect(records[0].metadata).toMatchObject({ finalizationRetryCount: 1 });
    expect(JSON.stringify(records)).not.toContain("PRIVATE REASONING");
  });

  it("fails after one empty finalization retry and never makes a third request", async () => {
    const fetcher = vi.fn(async () => completion("   ")) as typeof fetch;
    await expect(client(fetcher).structuredCompletion({
      ...input(),
      finalizationRetryMessages: input().messages,
    })).rejects.toMatchObject({
      code: "LLM_FINALIZATION_RETRY_FAILED",
      finalizationRetryCount: 1,
      externalRequestCount: 2,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not finalization-retry HTTP, invalid JSON, or schema failures", async () => {
    for (const [status, code] of [
      [401, "authentication_failed"],
      [429, "rate_limited"],
      [503, "provider_error"],
    ] as const) {
      const http = vi.fn(async () => new Response("", { status })) as typeof fetch;
      await expect(client(http).structuredCompletion({
        ...input(),
        allowTransportRetry: false,
        finalizationRetryMessages: input().messages,
      })).rejects.toMatchObject({ code });
      expect(http).toHaveBeenCalledOnce();
    }

    const invalidJson = vi.fn(async () => completion("not json")) as typeof fetch;
    await expect(client(invalidJson).structuredCompletion({
      ...input(),
      allowJsonRepair: false,
      finalizationRetryMessages: input().messages,
    })).rejects.toMatchObject({ code: "LLM_STRUCTURED_OUTPUT_INVALID" });
    expect(invalidJson).toHaveBeenCalledOnce();

    const invalidSchema = vi.fn(async () => completion('{"ok":false}')) as typeof fetch;
    await expect(client(invalidSchema).structuredCompletion({
      ...input(),
      allowJsonRepair: false,
      finalizationRetryMessages: input().messages,
    })).rejects.toMatchObject({ code: "LLM_SCHEMA_VALIDATION_FAILED" });
    expect(invalidSchema).toHaveBeenCalledOnce();
  });

  it("can disable transport retries independently", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(client(fetcher, { LLM_RETRY_COUNT: "3" }).structuredCompletion({
      ...input(),
      allowTransportRetry: false,
    })).rejects.toMatchObject({ code: "provider_error", requestAttempts: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("accepts an outer Markdown JSON fence", async () => {
    const fetcher = vi.fn(async () => completion('```json\n{"ok":true}\n```')) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).resolves.toMatchObject({ data: { ok: true } });
  });

  it("does not extract arbitrary JSON from surrounding prose", async () => {
    const fetcher = vi.fn(async () => completion('Here is JSON: {"ok":true}')) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).rejects.toMatchObject({
      code: "LLM_STRUCTURED_OUTPUT_INVALID",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("repairs invalid JSON exactly once", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(completion("not json"))
      .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
    const result = await client(fetcher).structuredCompletion(input());
    expect(result.metadata.repairCount).toBe(1);
    expect(result.metadata.externalRequestCount).toBe(2);
  });

  it("includes the explicit output contract in initial and repair requests", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(completion("{}"))
      .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
    await client(fetcher).structuredCompletion({
      ...input(),
      outputContract: "Object with exactly ok:true.",
    });

    const initialBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body));
    const repairBody = JSON.parse(String(vi.mocked(fetcher).mock.calls[1][1]?.body));
    expect(initialBody.messages.at(-1).content).toContain("Object with exactly ok:true.");
    expect(JSON.stringify(initialBody).match(/Object with exactly ok:true\./g)).toHaveLength(1);
    expect(JSON.stringify(repairBody).match(/Object with exactly ok:true\./g)).toHaveLength(1);
  });

  it("repairs a schema mismatch exactly once", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(completion('{"ok":false}'))
      .mockResolvedValueOnce(completion('{"ok":true}')) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).resolves.toMatchObject({ data: { ok: true } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails clearly when the repair is still invalid", async () => {
    const fetcher = vi.fn(async () => completion("{}")) as typeof fetch;
    await expect(client(fetcher).structuredCompletion(input())).rejects.toMatchObject({
      code: "LLM_SCHEMA_VALIDATION_FAILED",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("counts repair tokens and cost in the logical request", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(completion("bad", {
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }))
      .mockResolvedValueOnce(completion('{"ok":true}', {
        usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
      })) as typeof fetch;
    const result = await client(fetcher, {
      LLM_INPUT_PRICE_PER_MILLION: "2",
      LLM_OUTPUT_PRICE_PER_MILLION: "4",
    }).structuredCompletion(input());
    expect(result.usage).toEqual({ prompt_tokens: 16, completion_tokens: 5, total_tokens: 21 });
    expect(result.metadata.estimatedCostMicros).toBe(52);
  });
});

describe("fallback, observation, and secret safety", () => {
  it("does not fall back to Mock by default", async () => {
    const fetcher = vi.fn(async () => completion("{}")) as typeof fetch;
    const provider = new LLMJDAnalyzerProvider(client(fetcher));
    await expect(provider.analyze("TypeScript internship")).rejects.toBeInstanceOf(LLMClientError);
  });

  it("falls back only when explicitly enabled and records fallback separately", async () => {
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = { async record(record) { records.push(record); } };
    const fetcher = vi.fn(async () => completion("{}")) as typeof fetch;
    const provider = new LLMJDAnalyzerProvider(
      client(fetcher, {}, observer),
      new MockJDAnalyzerProvider(),
      true,
    );
    const result = await provider.analyze("Java Spring Boot MySQL Redis internship");
    expect(result.hardSkills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL", "Redis"]));
    expect(result.riskWarnings.join(" ")).toContain("deterministic");
    expect(records.map((record) => record.status)).toEqual(["failed", "fallback"]);
    expect(records[1]).toMatchObject({ provider: "mock", fallbackUsed: true });
    expect(records[1].metadata).toMatchObject({
      providerRequested: "llm_provider",
      providerUsed: "mock",
    });
  });

  it("calculates cost when usage and both prices exist", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}', {
      usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
    })) as typeof fetch;
    const result = await client(fetcher, {
      LLM_INPUT_PRICE_PER_MILLION: "3",
      LLM_OUTPUT_PRICE_PER_MILLION: "12",
    }).structuredCompletion(input());
    expect(result.metadata.estimatedCostMicros).toBe(600);
  });

  it("does not calculate cost when prices are missing", async () => {
    const fetcher = vi.fn(async () => completion('{"ok":true}', {
      usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
    })) as typeof fetch;
    expect((await client(fetcher).structuredCompletion(input())).metadata.estimatedCostMicros).toBeUndefined();
  });

  it("redacts API keys and never records prompts or authorization headers", async () => {
    const records: Array<Parameters<LLMCallObserver["record"]>[0]> = [];
    const observer: LLMCallObserver = { async record(record) { records.push(record); } };
    const fetcher = vi.fn(async () => {
      throw new Error("failed with test-secret and Bearer another-secret");
    }) as typeof fetch;
    let caught: unknown;
    try {
      await client(fetcher, {}, observer).structuredCompletion({
        ...input(),
        messages: [{ role: "user", content: "PRIVATE COMPLETE PROMPT" }],
      });
    } catch (error) {
      caught = error;
    }
    expect(String((caught as Error).message)).not.toContain("test-secret");
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("test-secret");
    expect(serialized).not.toContain("another-secret");
    expect(serialized).not.toContain("PRIVATE COMPLETE PROMPT");
    expect(serialized).not.toContain("Authorization");
  });

  it("ignores observer failures", async () => {
    const observer: LLMCallObserver = { async record() { throw new Error("database unavailable"); } };
    const fetcher = vi.fn(async () => completion('{"ok":true}')) as typeof fetch;
    await expect(client(fetcher, {}, observer).structuredCompletion(input())).resolves.toMatchObject({
      data: { ok: true },
    });
  });
});
