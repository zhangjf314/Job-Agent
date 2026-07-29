import { z } from "zod";
import {
  AIConfigurationError,
  getAIConfig,
  validateAIConfig,
  type AIConfig,
} from "@/lib/ai-config";
import { noopLLMCallObserver, type LLMCallObserver } from "./llm-observability";

export type LLMErrorCode =
  | "invalid_configuration"
  | "bad_request"
  | "authentication_failed"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "structured_output_invalid";

export class LLMClientError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly httpStatus?: number,
    public readonly requestId?: string,
    public requestAttempts = 0,
  ) {
    super(message);
    this.name = "LLMClientError";
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredCompletionInput<T> = {
  messages: ChatMessage[];
  schemaName: string;
  schema: z.ZodType<T>;
  jsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  outputContract?: string;
};

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string; reasoning_content?: unknown } }>;
  usage?: Usage;
  model?: string;
  id?: string;
};

export type LLMCompletionMetadata = {
  requestId: string;
  model: string;
  latencyMs: number;
  retryCount: number;
  repairCount: number;
  externalRequestCount: number;
  reasoningFieldPresent: boolean;
  estimatedCostMicros?: number;
  priceCurrency?: string;
};

type RequestResult = {
  content: string;
  usage?: Usage;
  requestId?: string;
  model?: string;
  retryCount: number;
  httpStatus: number;
  reasoningFieldPresent: boolean;
};

type ClientRuntime = {
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  createRequestId?: () => string;
};

function redact(message: string, config: AIConfig) {
  let safe = message;
  for (const secret of [config.apiKey]) {
    if (secret) safe = safe.split(secret).join("[redacted]");
  }
  return safe.replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]").slice(0, 500);
}

function parseStrictJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new LLMClientError(
      "structured_output_invalid",
      "LLM response was not a complete JSON value.",
    );
  }
}

function validationSummary(error: z.ZodError) {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ")
    .slice(0, 1000);
}

function addUsage(current: Usage | undefined, next: Usage | undefined): Usage | undefined {
  if (!current && !next) return undefined;
  const add = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0));
  return {
    prompt_tokens: add(current?.prompt_tokens, next?.prompt_tokens),
    completion_tokens: add(current?.completion_tokens, next?.completion_tokens),
    total_tokens: add(current?.total_tokens, next?.total_tokens),
  };
}

export function chatCompletionsEndpoint(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  const url = new URL(normalized);
  if (url.pathname === "" || url.pathname === "/") return `${normalized}/v1/chat/completions`;
  return `${normalized}/chat/completions`;
}

export class LLMClient {
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly createRequestId: () => string;

  constructor(
    private readonly config: AIConfig = getAIConfig(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly observer: LLMCallObserver = noopLLMCallObserver,
    runtime: ClientRuntime = {},
  ) {
    this.sleep = runtime.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = runtime.random ?? Math.random;
    this.createRequestId = runtime.createRequestId ?? (() => crypto.randomUUID());
  }

  async structuredCompletion<T>(
    input: StructuredCompletionInput<T>,
  ): Promise<{ data: T; usage?: Usage; metadata: LLMCompletionMetadata }> {
    try {
      validateAIConfig(this.config);
    } catch (error) {
      const message = error instanceof AIConfigurationError ? error.message : "Invalid LLM configuration.";
      throw new LLMClientError("invalid_configuration", message);
    }
    if (this.config.provider !== "llm_provider") {
      throw new LLMClientError("invalid_configuration", "AI_PROVIDER must be llm_provider for a real LLM request.");
    }

    const logicalRequestId = this.createRequestId();
    const startedAt = Date.now();
    const startedAtIso = new Date().toISOString();
    let usage: Usage | undefined;
    let retryCount = 0;
    let repairCount = 0;
    let externalRequestCount = 0;
    let providerRequestId: string | undefined;
    let httpStatus: number | undefined;
    let reasoningFieldPresent = false;

    try {
      const initial = await this.requestWithRetries(input.messages, input);
      externalRequestCount += initial.retryCount + 1;
      retryCount += initial.retryCount;
      usage = addUsage(usage, initial.usage);
      providerRequestId = initial.requestId;
      httpStatus = initial.httpStatus;
      reasoningFieldPresent ||= initial.reasoningFieldPresent;

      let parsed = this.validateContent(initial.content, input.schema);
      if (!parsed.success) {
        repairCount = 1;
        const repair = await this.requestWithRetries(
          [
            {
              role: "system",
              content: [
                `Repair the JSON so it matches schema "${input.schemaName}". Return only the corrected JSON value.`,
                input.outputContract ? `Required output contract: ${input.outputContract}` : "",
              ].filter(Boolean).join("\n"),
            },
            {
              role: "user",
              content: `Invalid output:\n${initial.content}\n\nValidation problem:\n${parsed.problem}`,
            },
          ],
          input,
        );
        externalRequestCount += repair.retryCount + 1;
        retryCount += repair.retryCount;
        usage = addUsage(usage, repair.usage);
        providerRequestId = repair.requestId ?? providerRequestId;
        httpStatus = repair.httpStatus;
        reasoningFieldPresent ||= repair.reasoningFieldPresent;
        parsed = this.validateContent(repair.content, input.schema);
      }

      if (!parsed.success) {
        throw new LLMClientError(
          "structured_output_invalid",
          `LLM structured output remained invalid after one repair attempt: ${parsed.problem}`,
          false,
          httpStatus,
          providerRequestId,
        );
      }

      const durationMs = Date.now() - startedAt;
      const estimatedCostMicros = this.estimateCost(usage);
      const metadata: LLMCompletionMetadata = {
        requestId: logicalRequestId,
        model: this.config.model,
        latencyMs: durationMs,
        retryCount,
        repairCount,
        externalRequestCount,
        reasoningFieldPresent,
        estimatedCostMicros,
        priceCurrency: estimatedCostMicros === undefined ? undefined : this.config.priceCurrency,
      };
      await this.record({
        operation: input.schemaName,
        provider: this.config.provider,
        model: this.config.model,
        status: "success",
        durationMs,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        estimatedCostMicros,
        fallbackUsed: false,
        metadata: {
          requestId: logicalRequestId,
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          providerRequestId,
          retryCount,
          repairCount,
          externalRequestCount,
          reasoningFieldPresent,
          httpStatus,
          priceCurrency: metadata.priceCurrency,
          providerRequested: "llm_provider",
          providerUsed: "llm_provider",
        },
      });
      return { data: parsed.data, usage, metadata };
    } catch (error) {
      const normalized = this.normalizeError(error);
      if (normalized.requestAttempts) {
        externalRequestCount += normalized.requestAttempts;
        retryCount += Math.max(0, normalized.requestAttempts - 1);
      }
      const durationMs = Date.now() - startedAt;
      await this.record({
        operation: input.schemaName,
        provider: this.config.provider,
        model: this.config.model || "(not configured)",
        status: "failed",
        durationMs,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        estimatedCostMicros: this.estimateCost(usage),
        errorCode: normalized.code,
        fallbackUsed: false,
        metadata: {
          requestId: logicalRequestId,
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          providerRequestId: normalized.requestId ?? providerRequestId,
          retryCount,
          repairCount,
          externalRequestCount,
          reasoningFieldPresent,
          httpStatus: normalized.httpStatus ?? httpStatus,
          priceCurrency: this.estimateCost(usage) === undefined ? undefined : this.config.priceCurrency,
          providerRequested: "llm_provider",
          providerUsed: "llm_provider",
        },
      });
      throw normalized;
    }
  }

  async recordFallback(operation: string, error: unknown) {
    const normalized = this.normalizeError(error);
    const timestamp = new Date().toISOString();
    await this.record({
      operation,
      provider: "mock",
      model: "deterministic-mock",
      status: "fallback",
      durationMs: 0,
      errorCode: normalized.code,
      fallbackUsed: true,
      metadata: {
        requestId: this.createRequestId(),
        startedAt: timestamp,
        completedAt: timestamp,
        providerRequested: "llm_provider",
        providerUsed: "mock",
        fallbackReason: normalized.code,
      },
    });
  }

  async recordSafeObservation(input: Parameters<LLMCallObserver["record"]>[0]) {
    await this.record(input);
  }

  private validateContent<T>(
    content: string,
    schema: z.ZodType<T>,
  ): { success: true; data: T } | { success: false; problem: string } {
    let json: unknown;
    try {
      json = parseStrictJson(content);
    } catch (error) {
      return { success: false, problem: error instanceof Error ? error.message : "Invalid JSON." };
    }
    const parsed = schema.safeParse(json);
    if (parsed.success) return { success: true, data: parsed.data };
    return { success: false, problem: validationSummary(parsed.error) };
  }

  private async requestWithRetries<T>(
    messages: ChatMessage[],
    input: StructuredCompletionInput<T>,
  ): Promise<RequestResult> {
    let lastError: LLMClientError | undefined;
    for (let attempt = 0; attempt <= this.config.retryCount; attempt += 1) {
      try {
        const result = await this.callOnce(messages, input);
        return { ...result, retryCount: attempt };
      } catch (error) {
        const normalized = this.normalizeError(error);
        lastError = normalized;
        if (!normalized.retryable || attempt === this.config.retryCount) {
          normalized.requestAttempts = attempt + 1;
          throw normalized;
        }
        const delay = Math.min(4000, 250 * 2 ** attempt) + Math.floor(this.random() * 100);
        await this.sleep(delay);
      }
    }
    throw lastError ?? new LLMClientError("provider_error", "LLM provider request failed.");
  }

  private async callOnce<T>(
    messages: ChatMessage[],
    input: StructuredCompletionInput<T>,
  ): Promise<Omit<RequestResult, "retryCount">> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(chatCompletionsEndpoint(this.config.baseUrl), {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: input.temperature ?? this.config.temperature,
          max_tokens: input.maxOutputTokens ?? this.config.maxOutputTokens,
          messages: [
            ...messages,
            {
              role: "user",
              content: [
                `Return only one JSON value matching schema "${input.schemaName}". Do not include commentary.`,
                input.outputContract ? `Required output contract: ${input.outputContract}` : "",
              ].filter(Boolean).join("\n"),
            },
          ],
          ...(this.config.jsonMode
            ? {
                response_format: input.jsonSchema
                  ? {
                      type: "json_schema",
                      json_schema: { name: input.schemaName, schema: input.jsonSchema, strict: false },
                    }
                  : { type: "json_object" },
              }
            : {}),
        }),
      });

      const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
      if (!response.ok) {
        const body = redact(await response.text(), this.config);
        throw this.httpError(response.status, body, requestId);
      }
      let json: CompletionResponse;
      try {
        json = (await response.json()) as CompletionResponse;
      } catch {
        throw new LLMClientError(
          "provider_error",
          "LLM provider returned an invalid HTTP response.",
          true,
          response.status,
          requestId,
        );
      }
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new LLMClientError(
          "structured_output_invalid",
          "LLM provider returned no message content.",
          false,
          response.status,
          requestId,
        );
      }
      return {
        content,
        usage: json.usage,
        requestId: requestId ?? json.id,
        model: json.model,
        httpStatus: response.status,
        reasoningFieldPresent: Object.prototype.hasOwnProperty.call(
          json.choices?.[0]?.message ?? {},
          "reasoning_content",
        ),
      };
    } catch (error) {
      if (error instanceof LLMClientError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new LLMClientError("timeout", "LLM request timed out.", true);
      }
      const message = error instanceof Error ? redact(error.message, this.config) : "Network request failed.";
      throw new LLMClientError("network_error", `LLM network request failed: ${message}`, true);
    } finally {
      clearTimeout(timer);
    }
  }

  private httpError(status: number, _body: string, requestId?: string) {
    if (status === 400) {
      const hint = this.config.jsonMode ? " If the provider does not support response_format, set LLM_JSON_MODE=false." : "";
      return new LLMClientError("bad_request", `LLM provider rejected the request (HTTP 400).${hint}`, false, status, requestId);
    }
    if (status === 401) return new LLMClientError("authentication_failed", "LLM authentication failed. Check LLM_API_KEY.", false, status, requestId);
    if (status === 403) return new LLMClientError("forbidden", "LLM provider denied this request (HTTP 403).", false, status, requestId);
    if (status === 404) return new LLMClientError("not_found", "LLM endpoint or model was not found (HTTP 404).", false, status, requestId);
    if (status === 408) return new LLMClientError("timeout", "LLM provider timed out (HTTP 408).", true, status, requestId);
    if (status === 429) return new LLMClientError("rate_limited", "LLM provider rate limit reached (HTTP 429).", true, status, requestId);
    if (status >= 500) return new LLMClientError("provider_error", `LLM provider failed (HTTP ${status}).`, true, status, requestId);
    return new LLMClientError("provider_error", `LLM provider returned HTTP ${status}.`, false, status, requestId);
  }

  private normalizeError(error: unknown) {
    if (error instanceof LLMClientError) return error;
    const message = error instanceof Error ? redact(error.message, this.config) : "LLM provider is unavailable.";
    return new LLMClientError("provider_error", message);
  }

  private estimateCost(usage?: Usage) {
    if (
      !usage ||
      this.config.inputPricePerMillion === undefined ||
      this.config.outputPricePerMillion === undefined ||
      usage.prompt_tokens === undefined ||
      usage.completion_tokens === undefined
    ) {
      return undefined;
    }
    return Math.round(
      usage.prompt_tokens * this.config.inputPricePerMillion +
        usage.completion_tokens * this.config.outputPricePerMillion,
    );
  }

  private async record(input: Parameters<LLMCallObserver["record"]>[0]) {
    try {
      await this.observer.record(input);
    } catch {
      // Observability must never break the user-facing AI flow.
    }
  }
}
