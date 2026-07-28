import { getAIConfig, isLLMConfigured, type AIConfig } from "@/lib/ai-config";
import { LLMClient } from "./llm-client";
import { LLMResumeWriterProvider, MockResumeWriter } from "./resume-writer";
import { LLMJDAnalyzerProvider, MockJDAnalyzerProvider } from "./jd-analyzer";
import { LLMTailoredResumeWriterProvider, MockTailoredResumeWriterProvider } from "./tailored-resume-writer";
import { LLMCareerStrategistProvider, MockCareerStrategistProvider } from "./career-strategist";
import { createDatabaseLLMCallObserver } from "./llm-observability";

export function getEffectiveAIProvider(config: AIConfig = getAIConfig()) {
  return isLLMConfigured(config) ? "llm_provider" : "mock";
}

export function createLLMClient(config: AIConfig = getAIConfig()) {
  return new LLMClient(config, fetch, createDatabaseLLMCallObserver());
}

export function createResumeWriterProvider(config: AIConfig = getAIConfig()) {
  return isLLMConfigured(config) ? new LLMResumeWriterProvider(createLLMClient(config)) : new MockResumeWriter();
}

export function createJDAnalyzerProvider(config: AIConfig = getAIConfig()) {
  return isLLMConfigured(config) ? new LLMJDAnalyzerProvider(createLLMClient(config)) : new MockJDAnalyzerProvider();
}

export function createTailoredResumeWriterProvider(config: AIConfig = getAIConfig()) {
  return isLLMConfigured(config)
    ? new LLMTailoredResumeWriterProvider(createLLMClient(config))
    : new MockTailoredResumeWriterProvider();
}

export function createCareerStrategistProvider(config: AIConfig = getAIConfig()) {
  return isLLMConfigured(config)
    ? new LLMCareerStrategistProvider(createLLMClient(config))
    : new MockCareerStrategistProvider();
}
