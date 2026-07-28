import { describe, expect, it, vi } from "vitest";
import { getAIConfig, isLLMConfigured, publicAIConfig } from "@/lib/ai-config";
import { getEffectiveAIProvider, createJDAnalyzerProvider } from "@/services/ai/provider-factory";
import { LLMClient, LLMClientError } from "@/services/ai/llm-client";
import { LLMJDAnalyzerProvider } from "@/services/ai/jd-analyzer";

describe("AI provider configuration", () => {
  it("uses mock when AI_PROVIDER is mock", () => {
    const config = getAIConfig({ AI_PROVIDER: "mock", LLM_API_KEY: "secret" });
    expect(getEffectiveAIProvider(config)).toBe("mock");
    expect(publicAIConfig(config).hasApiKey).toBe(true);
  });

  it("falls back to mock when LLM key is missing", () => {
    const config = getAIConfig({ AI_PROVIDER: "llm_provider", LLM_API_KEY: "" });
    expect(isLLMConfigured(config)).toBe(false);
    expect(getEffectiveAIProvider(config)).toBe("mock");
    expect(createJDAnalyzerProvider(config).constructor.name).toBe("MockJDAnalyzerProvider");
  });

  it("selects llm provider when configured", () => {
    const config = getAIConfig({ AI_PROVIDER: "llm_provider", LLM_API_KEY: "secret" });
    expect(getEffectiveAIProvider(config)).toBe("llm_provider");
    expect(createJDAnalyzerProvider(config).constructor.name).toBe("LLMJDAnalyzerProvider");
  });

  it("recognizes schema parse failures", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 })) as typeof fetch;
    const client = new LLMClient(getAIConfig({ AI_PROVIDER: "llm_provider", LLM_API_KEY: "secret" }), fetcher);

    await expect(client.structuredCompletion({
      schemaName: "tiny",
      schema: { safeParse: () => ({ success: false }) } as never,
      messages: [{ role: "user", content: "test" }],
    })).rejects.toMatchObject({ code: "schema_parse_failed" });
  });

  it("does not leak api key in provider errors", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network failed with secret-token");
    }) as unknown as typeof fetch;
    const client = new LLMClient(getAIConfig({ AI_PROVIDER: "llm_provider", LLM_API_KEY: "secret-token" }), fetcher);

    try {
      await client.structuredCompletion({
        schemaName: "tiny",
        schema: { safeParse: () => ({ success: true, data: { ok: true } }) } as never,
        messages: [{ role: "user", content: "test" }],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(LLMClientError);
      expect(String((error as Error).message)).not.toContain("secret-token");
    }
  });

  it("llm provider falls back to mock analyzer on invalid output", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })) as typeof fetch;
    const client = new LLMClient(getAIConfig({ AI_PROVIDER: "llm_provider", LLM_API_KEY: "secret" }), fetcher);
    const result = await new LLMJDAnalyzerProvider(client).analyze("Java Spring Boot MySQL Redis 本科 应届生");
    expect(result.hardSkills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "MySQL", "Redis"]));
    expect(result.riskWarnings.join(" ")).toContain("deterministic");
  });
});
