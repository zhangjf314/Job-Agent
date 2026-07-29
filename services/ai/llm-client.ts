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
  | "LLM_CHOICES_MISSING"
  | "LLM_MESSAGE_MISSING"
  | "LLM_EMPTY_FINAL_CONTENT"
  | "LLM_EMPTY_FINAL_CONTENT_AFTER_REASONING"
  | "LLM_OUTPUT_LIMIT_REACHED_WITHOUT_FINAL_CONTENT"
  | "LLM_FINALIZATION_RETRY_FAILED"
  | "LLM_STRUCTURED_OUTPUT_INVALID"
  | "LLM_SCHEMA_VALIDATION_FAILED"
  | "SMOKE_EXTERNAL_REQUEST_LIMIT_REACHED";

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type LLMResponseSafetySummary = {
  responseId: string | null;
  choiceCount: number;
  firstChoicePresent: boolean;
  messagePresent: boolean;
  contentState: "missing" | "null" | "empty" | "whitespace" | "present";
  contentCharacterLength: number | null;
  contentByteLength: number | null;
  finishReason: string | null;
  reasoningFieldPresent: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  outputLimitReached: boolean | null;
};

export class LLMClientError extends Error {
  public responseSummary?: LLMResponseSafetySummary;
  public usage?: Usage;
  public retryCount = 0;
  public repairCount = 0;
  public finalizationRetryCount = 0;
  public externalRequestCount = 0;
  public latencyMs?: number;

  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly httpStatus?: number,
    public readonly requestId?: string,
    public requestAttempts = 0,
    details?: {
      responseSummary?: LLMResponseSafetySummary;
      usage?: Usage;
    },
  ) {
    super(message);
    this.name = "LLMClientError";
    this.responseSummary = details?.responseSummary;
    this.usage = details?.usage;
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
  finalizationRetryMessages?: ChatMessage[];
  allowFinalizationRetry?: boolean;
  allowJsonRepair?: boolean;
  allowTransportRetry?: boolean;
};

type CompletionResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: unknown;
    } | null;
  }> | null;
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
  finalizationRetryCount: number;
  externalRequestCount: number;
  reasoningFieldPresent: boolean;
  responseSafetySummary: LLMResponseSafetySummary;
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
  responseSafetySummary: LLMResponseSafetySummary;
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
      "LLM_STRUCTURED_OUTPUT_INVALID",
      "LLM response was not a complete JSON value.",
    );
  }
}

function contentState(message?: {
  content?: string | null;
  reasoning_content?: unknown;
} | null): LLMResponseSafetySummary["contentState"] {
  if (!message || !Object.prototype.hasOwnProperty.call(message, "content")) return "missing";
  if (message.content === null) return "null";
  if (message.content === "") return "empty";
  if (typeof message.content === "string" && !message.content.trim()) return "whitespace";
  return typeof message.content === "string" ? "present" : "missing";
}

function responseSafetySummary(
  response: CompletionResponse,
  maxOutputTokens: number,
): LLMResponseSafetySummary {
  const firstChoice = response.choices?.[0];
  const message = firstChoice?.message;
  const state = contentState(message);
  const content = typeof message?.content === "string" ? message.content : null;
  const finishReason = typeof firstChoice?.finish_reason === "string"
    ? firstChoice.finish_reason
    : null;
  const completionTokens = response.usage?.completion_tokens ?? null;
  const outputLimitReached = finishReason === "length" ||
      completionTokens === maxOutputTokens
    ? true
    : finishReason !== null && finishReason !== "length" &&
        completionTokens !== null && completionTokens < maxOutputTokens
      ? false
      : null;
  return {
    responseId: typeof response.id === "string" ? response.id : null,
    choiceCount: Array.isArray(response.choices) ? response.choices.length : 0,
    firstChoicePresent: firstChoice !== undefined,
    messagePresent: message != null,
    contentState: state,
    contentCharacterLength: content === null ? null : Array.from(content).length,
    contentByteLength: content === null ? null : new TextEncoder().encode(content).length,
    finishReason,
    reasoningFieldPresent: Object.prototype.hasOwnProperty.call(message ?? {}, "reasoning_content"),
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens,
    totalTokens: response.usage?.total_tokens ?? null,
    outputLimitReached,
  };
}

function responseMetadata(summary?: LLMResponseSafetySummary) {
  return summary ? { ...summary } : {};
}

function isFinalContentError(error: LLMClientError) {
  return [
    "LLM_EMPTY_FINAL_CONTENT",
    "LLM_EMPTY_FINAL_CONTENT_AFTER_REASONING",
    "LLM_OUTPUT_LIMIT_REACHED_WITHOUT_FINAL_CONTENT",
  ].includes(error.code);
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
    let finalizationRetryCount = 0;
    let externalRequestCount = 0;
    let providerRequestId: string | undefined;
    let httpStatus: number | undefined;
    let reasoningFieldPresent = false;
    let latestResponseSummary: LLMResponseSafetySummary | undefined;

    try {
      let initial: RequestResult;
      try {
        initial = await this.requestWithRetries(input.messages, input);
      } catch (error) {
        const emptyError = this.normalizeError(error);
        latestResponseSummary = emptyError.responseSummary;
        reasoningFieldPresent ||= emptyError.responseSummary?.reasoningFieldPresent ?? false;
        providerRequestId = emptyError.requestId;
        httpStatus = emptyError.httpStatus;
        if (
          input.allowFinalizationRetry !== false &&
          input.finalizationRetryMessages &&
          isFinalContentError(emptyError)
        ) {
          usage = addUsage(usage, emptyError.usage);
          externalRequestCount += emptyError.requestAttempts;
          retryCount += Math.max(0, emptyError.requestAttempts - 1);
          finalizationRetryCount = 1;
          try {
            initial = await this.requestWithRetries(input.finalizationRetryMessages, {
              ...input,
              allowFinalizationRetry: false,
            });
          } catch (retryError) {
            const finalError = this.normalizeError(retryError);
            latestResponseSummary = finalError.responseSummary ?? latestResponseSummary;
            reasoningFieldPresent ||=
              finalError.responseSummary?.reasoningFieldPresent ?? false;
            if (!isFinalContentError(finalError)) throw finalError;
            usage = addUsage(usage, finalError.usage);
            externalRequestCount += finalError.requestAttempts;
            retryCount += Math.max(0, finalError.requestAttempts - 1);
            throw new LLMClientError(
              "LLM_FINALIZATION_RETRY_FAILED",
              "LLM finalization retry did not return usable final content.",
              false,
              finalError.httpStatus,
              finalError.requestId,
              0,
              {
                responseSummary: latestResponseSummary,
              },
            );
          }
        } else {
          throw emptyError;
        }
      }
      externalRequestCount += initial.retryCount + 1;
      retryCount += initial.retryCount;
      usage = addUsage(usage, initial.usage);
      providerRequestId = initial.requestId;
      httpStatus = initial.httpStatus;
      reasoningFieldPresent ||= initial.reasoningFieldPresent;
      latestResponseSummary = initial.responseSafetySummary;

      let parsed = this.validateContent(initial.content, input.schema);
      if (!parsed.success && input.allowJsonRepair !== false) {
        repairCount = 1;
        const repair = await this.requestWithRetries(
          [
            {
              role: "system",
              content:
                `Repair the JSON so it matches schema "${input.schemaName}". Return only the corrected JSON value.`,
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
        latestResponseSummary = repair.responseSafetySummary;
        parsed = this.validateContent(repair.content, input.schema);
      }

      if (!parsed.success) {
        throw new LLMClientError(
          parsed.code,
          `LLM structured output remained invalid after one repair attempt: ${parsed.problem}`,
          false,
          httpStatus,
          providerRequestId,
          0,
          { responseSummary: latestResponseSummary },
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
        finalizationRetryCount,
        externalRequestCount,
        reasoningFieldPresent,
        responseSafetySummary: latestResponseSummary!,
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
          finalizationRetryCount,
          externalRequestCount,
          reasoningFieldPresent,
          httpStatus,
          ...responseMetadata(latestResponseSummary),
          priceCurrency: metadata.priceCurrency,
          providerRequested: "llm_provider",
          providerUsed: "llm_provider",
        },
      });
      return { data: parsed.data, usage, metadata };
    } catch (error) {
      const normalized = this.normalizeError(error);
      usage = addUsage(usage, normalized.usage);
      latestResponseSummary = normalized.responseSummary ?? latestResponseSummary;
      reasoningFieldPresent ||=
        normalized.responseSummary?.reasoningFieldPresent ?? false;
      if (normalized.requestAttempts) {
        externalRequestCount += normalized.requestAttempts;
        retryCount += Math.max(0, normalized.requestAttempts - 1);
      }
      const durationMs = Date.now() - startedAt;
      normalized.usage = usage;
      normalized.responseSummary = latestResponseSummary;
      normalized.retryCount = retryCount;
      normalized.repairCount = repairCount;
      normalized.finalizationRetryCount = finalizationRetryCount;
      normalized.externalRequestCount = externalRequestCount;
      normalized.latencyMs = durationMs;
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
          finalizationRetryCount,
          externalRequestCount,
          reasoningFieldPresent,
          httpStatus: normalized.httpStatus ?? httpStatus,
          ...responseMetadata(latestResponseSummary),
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
  ): { success: true; data: T } | {
    success: false;
    problem: string;
    code: "LLM_STRUCTURED_OUTPUT_INVALID" | "LLM_SCHEMA_VALIDATION_FAILED";
  } {
    let json: unknown;
    try {
      json = parseStrictJson(content);
    } catch (error) {
      return {
        success: false,
        problem: error instanceof Error ? error.message : "Invalid JSON.",
        code: "LLM_STRUCTURED_OUTPUT_INVALID",
      };
    }
    const parsed = schema.safeParse(json);
    if (parsed.success) return { success: true, data: parsed.data };
    return {
      success: false,
      problem: validationSummary(parsed.error),
      code: "LLM_SCHEMA_VALIDATION_FAILED",
    };
  }

  private async requestWithRetries<T>(
    messages: ChatMessage[],
    input: StructuredCompletionInput<T>,
  ): Promise<RequestResult> {
    let lastError: LLMClientError | undefined;
    const retryLimit = input.allowTransportRetry === false ? 0 : this.config.retryCount;
    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      try {
        const result = await this.callOnce(messages, input);
        return { ...result, retryCount: attempt };
      } catch (error) {
        const normalized = this.normalizeError(error);
        lastError = normalized;
        if (!normalized.retryable || attempt === retryLimit) {
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
      const summary = responseSafetySummary(
        json,
        input.maxOutputTokens ?? this.config.maxOutputTokens,
      );
      const content = json.choices?.[0]?.message?.content;
      if (!summary.firstChoicePresent) {
        throw new LLMClientError(
          "LLM_CHOICES_MISSING",
          "LLM provider returned no completion choice.",
          false,
          response.status,
          requestId ?? json.id,
          0,
          { responseSummary: summary, usage: json.usage },
        );
      }
      if (!summary.messagePresent) {
        throw new LLMClientError(
          "LLM_MESSAGE_MISSING",
          "LLM provider returned a choice without a message.",
          false,
          response.status,
          requestId ?? json.id,
          0,
          { responseSummary: summary, usage: json.usage },
        );
      }
      if (typeof content !== "string" || !content.trim()) {
        const code: LLMErrorCode = summary.outputLimitReached
          ? "LLM_OUTPUT_LIMIT_REACHED_WITHOUT_FINAL_CONTENT"
          : summary.reasoningFieldPresent
            ? "LLM_EMPTY_FINAL_CONTENT_AFTER_REASONING"
            : "LLM_EMPTY_FINAL_CONTENT";
        throw new LLMClientError(
          code,
          "LLM provider returned no usable final message content.",
          false,
          response.status,
          requestId ?? json.id,
          0,
          { responseSummary: summary, usage: json.usage },
        );
      }
      return {
        content,
        usage: json.usage,
        requestId: requestId ?? json.id,
        model: json.model,
        httpStatus: response.status,
        reasoningFieldPresent: summary.reasoningFieldPresent,
        responseSafetySummary: summary,
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
