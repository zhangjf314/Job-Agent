import { getAIConfig, validateAIConfig, type AIConfig } from "@/lib/ai-config";
import { LLMClient } from "./llm-client";
import { LLMResumeWriterProvider, MockResumeWriter } from "./resume-writer";
import { LLMJDAnalyzerProvider, MockJDAnalyzerProvider } from "./jd-analyzer";
import { LLMTailoredResumeWriterProvider, MockTailoredResumeWriterProvider } from "./tailored-resume-writer";
import { LLMCareerStrategistProvider, MockCareerStrategistProvider } from "./career-strategist";
import { createDatabaseLLMCallObserver } from "./llm-observability";

export function getEffectiveAIProvider(config: AIConfig = getAIConfig()) {
  if (config.provider === "mock") return "mock";
  validateAIConfig(config);
  return "llm_provider";
}

export function createLLMClient(config: AIConfig = getAIConfig()) {
  validateAIConfig(config);
  return new LLMClient(config, fetch, createDatabaseLLMCallObserver());
}

export function createResumeWriterProvider(config: AIConfig = getAIConfig()) {
  return getEffectiveAIProvider(config) === "llm_provider"
    ? new LLMResumeWriterProvider(createLLMClient(config), new MockResumeWriter(), config.fallbackToMock)
    : new MockResumeWriter();
}

export function createJDAnalyzerProvider(config: AIConfig = getAIConfig()) {
  return getEffectiveAIProvider(config) === "llm_provider"
    ? new LLMJDAnalyzerProvider(createLLMClient(config), new MockJDAnalyzerProvider(), config.fallbackToMock)
    : new MockJDAnalyzerProvider();
}

export function createTailoredResumeWriterProvider(config: AIConfig = getAIConfig()) {
  return getEffectiveAIProvider(config) === "llm_provider"
    ? new LLMTailoredResumeWriterProvider(
        createLLMClient(config),
        new MockTailoredResumeWriterProvider(),
        config.fallbackToMock,
      )
    : new MockTailoredResumeWriterProvider();
}

export function createCareerStrategistProvider(config: AIConfig = getAIConfig()) {
  return getEffectiveAIProvider(config) === "llm_provider"
    ? new LLMCareerStrategistProvider(
        createLLMClient(config),
        new MockCareerStrategistProvider(),
        config.fallbackToMock,
      )
    : new MockCareerStrategistProvider();
}
