export type AIProviderMode = "mock" | "llm_provider";
export type LLMThinkingMode = "provider_default" | "enabled" | "disabled";

export type AIConfig = {
  provider: AIProviderMode;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  temperature: number;
  maxOutputTokens: number;
  retryCount: number;
  jsonMode: boolean;
  thinkingMode: LLMThinkingMode;
  fallbackToMock: boolean;
  priceCurrency: string;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
};

export class AIConfigurationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid LLM configuration: ${issues.join("; ")}`);
    this.name = "AIConfigurationError";
  }
}

function providerMode(value?: string): AIProviderMode {
  return value === "llm_provider" ? "llm_provider" : "mock";
}

function numberValue(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  return Number(value);
}

function optionalNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return undefined;
  return Number(value);
}

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return value.toLowerCase() === "true";
}

function thinkingModeValue(value: string | undefined): LLMThinkingMode {
  const normalized = value?.trim() || "provider_default";
  if (
    normalized === "provider_default" ||
    normalized === "enabled" ||
    normalized === "disabled"
  ) {
    return normalized;
  }
  throw new AIConfigurationError([
    "LLM_THINKING_MODE must be provider_default, enabled, or disabled",
  ]);
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getAIConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AIConfig {
  return {
    provider: providerMode(env.AI_PROVIDER),
    apiKey: env.LLM_API_KEY?.trim() ?? "",
    model: env.LLM_MODEL?.trim() ?? "",
    baseUrl: normalizeBaseUrl(env.LLM_BASE_URL ?? ""),
    timeoutMs: numberValue(env.LLM_TIMEOUT_MS, 30000),
    temperature: numberValue(env.LLM_TEMPERATURE, 0.2),
    maxOutputTokens: numberValue(env.LLM_MAX_OUTPUT_TOKENS, 1600),
    retryCount: numberValue(env.LLM_RETRY_COUNT, 2),
    jsonMode: booleanValue(env.LLM_JSON_MODE, true),
    thinkingMode: thinkingModeValue(env.LLM_THINKING_MODE),
    fallbackToMock: booleanValue(env.LLM_FALLBACK_TO_MOCK, false),
    priceCurrency: (env.LLM_PRICE_CURRENCY || "USD").trim().toUpperCase(),
    inputPricePerMillion: optionalNumber(env.LLM_INPUT_PRICE_PER_MILLION),
    outputPricePerMillion: optionalNumber(env.LLM_OUTPUT_PRICE_PER_MILLION),
  };
}

export function validateAIConfig(config: AIConfig) {
  if (config.provider === "mock") return config;

  const issues: string[] = [];
  if (!config.apiKey) issues.push("LLM_API_KEY is required");
  if (!config.model) issues.push("LLM_MODEL is required");
  if (!config.baseUrl) {
    issues.push("LLM_BASE_URL is required");
  } else {
    try {
      const url = new URL(config.baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) issues.push("LLM_BASE_URL must use HTTP or HTTPS");
    } catch {
      issues.push("LLM_BASE_URL must be a valid URL");
    }
  }
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 120000) {
    issues.push("LLM_TIMEOUT_MS must be between 100 and 120000");
  }
  if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) {
    issues.push("LLM_TEMPERATURE must be between 0 and 2");
  }
  if (!Number.isInteger(config.maxOutputTokens) || config.maxOutputTokens < 1 || config.maxOutputTokens > 131072) {
    issues.push("LLM_MAX_OUTPUT_TOKENS must be an integer between 1 and 131072");
  }
  if (!Number.isInteger(config.retryCount) || config.retryCount < 0 || config.retryCount > 5) {
    issues.push("LLM_RETRY_COUNT must be an integer between 0 and 5");
  }
  if (
    config.inputPricePerMillion !== undefined &&
    (!Number.isFinite(config.inputPricePerMillion) || config.inputPricePerMillion < 0)
  ) {
    issues.push("LLM_INPUT_PRICE_PER_MILLION must be a non-negative number");
  }
  if (
    config.outputPricePerMillion !== undefined &&
    (!Number.isFinite(config.outputPricePerMillion) || config.outputPricePerMillion < 0)
  ) {
    issues.push("LLM_OUTPUT_PRICE_PER_MILLION must be a non-negative number");
  }
  if (!config.priceCurrency) issues.push("LLM_PRICE_CURRENCY cannot be empty");

  if (issues.length) throw new AIConfigurationError(issues);
  return config;
}

export function isLLMConfigured(config = getAIConfig()) {
  if (config.provider !== "llm_provider") return false;
  try {
    validateAIConfig(config);
    return true;
  } catch {
    return false;
  }
}

function safeBaseUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "(invalid URL)";
  }
}

export function publicAIConfig(config = getAIConfig()) {
  let configurationIssues: string[] = [];
  if (config.provider === "llm_provider") {
    try {
      validateAIConfig(config);
    } catch (error) {
      configurationIssues = error instanceof AIConfigurationError ? error.issues : ["Unknown configuration error"];
    }
  }
  return {
    provider: config.provider,
    model: config.model || "(not configured)",
    baseUrl: safeBaseUrl(config.baseUrl),
    hasApiKey: Boolean(config.apiKey),
    effectiveProvider: configurationIssues.length ? "configuration_error" : config.provider,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    retryCount: config.retryCount,
    jsonMode: config.jsonMode,
    thinkingMode: config.thinkingMode,
    fallbackToMock: config.fallbackToMock,
    hasCostEstimation:
      config.inputPricePerMillion !== undefined && config.outputPricePerMillion !== undefined,
    configurationIssues,
  };
}
