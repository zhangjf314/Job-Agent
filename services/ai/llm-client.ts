import { z } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/ai-config";
import { noopLLMCallObserver, type LLMCallObserver } from "./llm-observability";

export type LLMErrorCode =
  | "missing_api_key"
  | "authentication_failed"
  | "rate_limited"
  | "timeout"
  | "schema_parse_failed"
  | "provider_unavailable";

export class LLMClientError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LLMClientError";
  }
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StructuredCompletionInput<T> = {
  messages: ChatMessage[];
  schemaName: string;
  schema: z.ZodType<T>;
  jsonSchema?: unknown;
  temperature?: number;
};

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function withoutSecrets(message: string, config: AIConfig) {
  return config.apiKey ? message.split(config.apiKey).join("[redacted]") : message;
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new LLMClientError("schema_parse_failed", "LLM response was not valid JSON.");
  }
}

export class LLMClient {
  constructor(
    private readonly config: AIConfig = getAIConfig(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly observer: LLMCallObserver = noopLLMCallObserver,
  ) {}

  async structuredCompletion<T>(input: StructuredCompletionInput<T>): Promise<{ data: T; usage?: unknown }> {
    if (!this.config.apiKey.trim()) {
      throw new LLMClientError("missing_api_key", "LLM API key is not configured.");
    }

    const startedAt = Date.now();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await this.callOnce(input);
        await this.record({
          operation: input.schemaName,
          provider: this.config.provider,
          model: this.config.model,
          status: "success",
          durationMs: Date.now() - startedAt,
          promptTokens: result.usage?.prompt_tokens,
          completionTokens: result.usage?.completion_tokens,
          totalTokens: result.usage?.total_tokens,
          fallbackUsed: false,
          metadata: { attempts: attempt + 1 },
        });
        return result;
      } catch (error) {
        lastError = error;
        if (error instanceof LLMClientError && error.code === "schema_parse_failed" && attempt === 0) continue;
        if (attempt === 0 && !(error instanceof LLMClientError && error.code === "authentication_failed")) continue;
        break;
      }
    }

    const normalized = lastError instanceof LLMClientError
      ? lastError
      : new LLMClientError("provider_unavailable", "LLM provider is unavailable.");
    await this.record({
      operation: input.schemaName,
      provider: this.config.provider,
      model: this.config.model,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: normalized.code,
      fallbackUsed: true,
    });
    if (lastError instanceof LLMClientError) throw lastError;
    throw new LLMClientError("provider_unavailable", "LLM provider is unavailable.");
  }

  private async record(input: Parameters<LLMCallObserver["record"]>[0]) {
    try {
      await this.observer.record(input);
    } catch {
      // Observability must never break the user-facing AI flow.
    }
  }

  private async callOnce<T>(input: StructuredCompletionInput<T>): Promise<{ data: T; usage?: CompletionResponse["usage"] }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: input.temperature ?? this.config.temperature,
          messages: [
            ...input.messages,
            {
              role: "user",
              content: `Return only one JSON object matching schema "${input.schemaName}". Do not include markdown fences.`,
            },
          ],
          response_format: input.jsonSchema
            ? {
                type: "json_schema",
                json_schema: { name: input.schemaName, schema: input.jsonSchema, strict: false },
              }
            : { type: "json_object" },
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throw new LLMClientError("authentication_failed", "LLM authentication failed. Check LLM_API_KEY.");
      }
      if (response.status === 429) throw new LLMClientError("rate_limited", "LLM provider rate limit reached.");
      if (!response.ok) {
        throw new LLMClientError("provider_unavailable", `LLM provider returned HTTP ${response.status}.`);
      }

      const json = (await response.json()) as CompletionResponse;
      const content = json.choices?.[0]?.message?.content ?? "";
      const parsed = input.schema.safeParse(parseJsonObject(content));
      if (!parsed.success) {
        throw new LLMClientError("schema_parse_failed", "LLM response did not match the expected schema.");
      }
      return { data: parsed.data, usage: json.usage };
    } catch (error) {
      if (error instanceof LLMClientError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMClientError("timeout", "LLM request timed out.");
      }
      if (error instanceof Error) {
        throw new LLMClientError("provider_unavailable", withoutSecrets(error.message, this.config));
      }
      throw new LLMClientError("provider_unavailable", "LLM provider is unavailable.");
    } finally {
      clearTimeout(timer);
    }
  }
}
