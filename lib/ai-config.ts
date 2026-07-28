export type AIProviderMode = "mock" | "llm_provider";

export type AIConfig = {
  provider: AIProviderMode;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  temperature: number;
};

function providerMode(value?: string): AIProviderMode {
  return value === "llm_provider" ? "llm_provider" : "mock";
}

function numberValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAIConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AIConfig {
  return {
    provider: providerMode(env.AI_PROVIDER),
    apiKey: env.LLM_API_KEY ?? "",
    model: env.LLM_MODEL || "gpt-4.1-mini",
    baseUrl: (env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    timeoutMs: numberValue(env.LLM_TIMEOUT_MS, 30000),
    temperature: numberValue(env.LLM_TEMPERATURE, 0.2),
  };
}

export function isLLMConfigured(config = getAIConfig()) {
  return config.provider === "llm_provider" && Boolean(config.apiKey.trim());
}

export function publicAIConfig(config = getAIConfig()) {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKey.trim()),
    effectiveProvider: isLLMConfigured(config) ? "llm_provider" : "mock",
  };
}
